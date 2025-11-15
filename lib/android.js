import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detect as detectJDK } from './jdk.js';
import { expand } from './util/expand.js';
import { loadManifestJson } from './util/load-manifest-json.js';
import which from 'which';
import * as version from './util/version.js';

const exe = process.platform === 'win32' ? '.exe' : '';
const cmd = process.platform === 'win32' ? '.cmd' : '';
const commandPrefix = process.env.APPC_ENV ? 'appc ' : '';
const requiredSdkTools = {
	adb: exe,
	emulator: exe
};
const pkgPropRegExp = /^([^=]*)=\s*(.+)$/;

let envCache;

// Common paths to scan for Android SDK/NDK
const dirs = process.platform === 'win32'
	? [ '%SystemDrive%', '%ProgramFiles%', '%ProgramFiles(x86)%', '%CommonProgramFiles%', '~', '%LOCALAPPDATA%/Android' ]
	: [
		'/opt',
		'/opt/local',
		'/usr',
		'/usr/local',
		'/usr/local/share', // homebrew cask installs sdk/ndk (symlinks) to /usr/local/share/android-(sdk|ndk)
		'~',
		'~/Library/Android' // Android Studio installs the NDK to ~/Library/Android/Sdk/ndk-bundle
	];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// find the SDK's manifest.json file
let manifestJson = loadManifestJson(__dirname);

// need to find the android module and its package.json
let androidPackageJson = {};
{
	const { root } = path.parse(__dirname);
	let currentDir = path.join(__dirname, '..', '..', '..');

	while (currentDir !== root) {
		const file = path.join(currentDir, 'android', 'package.json');
		if (fs.existsSync(file)) {
			androidPackageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
			break;
		}
		currentDir = path.dirname(currentDir);
	}
}

// allow overridding for tests
export function setAndroidPackageJson(json) {
	androidPackageJson = json;
}

async function detectSDK(config) {
	// first let's check the config's value
	let sdk = await findSDK(config.get('android.sdkPath'), config, androidPackageJson);
	if (sdk) {
		return sdk;
	}

	sdk = await findSDK(process.env.ANDROID_SDK_ROOT, config, androidPackageJson);
	if (sdk) {
		return sdk;
	}

	sdk = await findSDK(process.env.ANDROID_SDK, config, androidPackageJson);
	if (sdk) {
		return sdk;
	}

	let adb = config.get('android.executables.adb');
	if (adb) {
		adb = await which(adb, { nothrow: true });
	}
	if (!adb) {
		adb = await which('adb', { nothrow: true });
	}
	if (adb) {
		sdk = await findSDK(expand(adb, '..', '..'), config, androidPackageJson);
		if (sdk) {
			return sdk;
		}
	}

	for (let dir of dirs) {
		dir = expand(dir);
		try {
			if (fs.existsSync(dir)) {
				for (const name of fs.readdirSync(dir)) {
					const subdir = path.join(dir, name);
					if (/android|sdk/i.test(name) && fs.existsSync(subdir) && fs.statSync(subdir).isDirectory()) {
						sdk = await findSDK(subdir, config, androidPackageJson);
						if (sdk) {
							return sdk;
						}

						// this dir may be the Android SDK, but just in case,
						// let's see if there's an Android folder in this one
						if (fs.statSync(subdir).isDirectory()) {
							for (const name of fs.readdirSync(subdir)) {
								if (/android/i.test(name)) {
									sdk = await findSDK(path.join(subdir, name), config, androidPackageJson);
									if (sdk) {
										return sdk;
									}
								}
							}
						}
					}
				}
			}
		} catch {
			// Ignore
		}
	}

	return null;
}

async function detectNDK(config) {
	let ndk = await findNDK(config.get('android.ndkPath'));
	if (ndk) {
		return ndk;
	}

	ndk = await findNDK(process.env.ANDROID_NDK);
	if (ndk) {
		return ndk;
	}

	// try finding the 'ndk-build' executable
	let ndkbuild = config.get('android.executables.ndkbuild');
	if (ndkbuild) {
		ndkbuild = await which(ndkbuild, { nothrow: true });
	}
	if (!ndkbuild) {
		ndkbuild = await which(`ndk-build${cmd}`, { nothrow: true });
	}
	if (ndkbuild) {
		ndk = await findNDK(expand(ndkbuild, '..', '..'));
		if (ndk) {
			return ndk;
		}
	}

	for (let dir of dirs) {
		dir = expand(dir);
		try {
			if (fs.existsSync(dir)) {
				for (const name of fs.readdirSync(dir)) {
					const subdir = path.join(dir, name);
					if (/android|sdk/i.test(name)) {
						ndk = await findNDK(subdir);
						if (ndk) {
							return ndk;
						}

						// Check under NDK side-by-side directory which contains multiple NDK installations.
						// Each subfolder is named after the version of NDK installed under it. Favor newest version.
						const ndkSideBySidePath = path.join(subdir, 'ndk');
						if (fs.existsSync(ndkSideBySidePath) && fs.statSync(ndkSideBySidePath).isDirectory()) {
							const fileNames = fs.readdirSync(ndkSideBySidePath);
							fileNames.sort((text1, text2) => {
								// Flip result to sort in descending order. (ie: Highest version is first.)
								return versionStringComparer(text1, text2) * (-1);
							});
							for (const nextFileName of fileNames) {
								const nextFilePath = path.join(ndkSideBySidePath, nextFileName);
								ndk = await findNDK(nextFilePath);
								if (ndk) {
									return ndk;
								}
							}
						}

						// Android Studio used to install under Android SDK subfolder "ndk-bundle". (Deprecated in 2019.)
						const ndkBundlePath = path.join(subdir, 'ndk-bundle');
						if (fs.existsSync(ndkBundlePath) && fs.statSync(ndkBundlePath).isDirectory()) {
							ndk = await findNDK(ndkBundlePath);
							if (ndk) {
								return ndk;
							}
						}
					}
				}
			}
		} catch {
			// Ignore
		}
	}

	return null;
}

async function detectLinux64bit(config) {
	if (process.platform !== 'linux' || process.arch !== 'x64') {
		return null;
	}

	// detect if we're using a 64-bit Linux OS that's missing 32-bit libraries
	const result = {
		libGL: fs.existsSync('/usr/lib/libGL.so'),
		i386arch: null,
		'libc6:i386': null,
		'libncurses5:i386': null,
		'libstdc++6:i386': null,
		'zlib1g:i386': null,
	};

	await Promise.all([
		(async () => {
			let dpkg = config.get('linux.dpkg');
			if (dpkg) {
				dpkg = await which(dpkg, { nothrow: true });
			}
			if (!dpkg) {
				dpkg = await which('dpkg', { nothrow: true });
			}

			const archs = {};
			await new Promise((resolve) => {
				let stdout = '';
				const child = spawn(dpkg, ['--print-architecture'], { stdio: ['ignore', 'pipe', 'ignore'] });
				child.stdout.on('data', data => stdout += data.toString());
				child.on('close', code => {
					if (code === 0) {
						for (let line of stdout.split('\n')) {
							line = line.trim();
							if (line) {
								archs[line] = 1;
							}
						}
					}
					resolve();
				});
			});

			await new Promise((resolve) => {
				let stdout = '';
				const child = spawn(dpkg, ['--print-foreign-architectures'], { stdio: ['ignore', 'pipe', 'ignore'] });
				child.stdout.on('data', data => stdout += data.toString());
				child.on('close', code => {
					if (code === 0) {
						for (let line of stdout.split('\n')) {
							line = line.trim();
							if (line) {
								archs[line] = 1;
							}
						}

						// now that we have the architectures, make sure we have the i386 architecture
						result.i386arch = !!archs.i386;
					}
					resolve();
				});
			});
		})(),
		(async () => {
			let dpkgquery = config.get('linux.dpkgquery');
			if (dpkgquery) {
				dpkgquery = await which(dpkgquery, { nothrow: true });
			}
			if (!dpkgquery) {
				dpkgquery = await which('dpkg-query', { nothrow: true });
			}
			if (!dpkgquery) {
				return null;
			}

			const packages = [ 'libc6:i386', 'libncurses5:i386', 'libstdc++6:i386', 'zlib1g:i386' ];
			for (const pkg of packages) {
				await new Promise((resolve) => {
					let stdout = '';
					const child = spawn(dpkgquery, ['-l', pkg], { stdio: ['ignore', 'pipe', 'ignore'] });
					child.stdout.on('data', data => stdout += data.toString());
					child.on('close', code => {
						result[pkg] = false;
						if (code === 0) {
							for (let line of stdout.split('\n')) {
								line = line.trim();
								if (line.includes(pkg)) {
									result[pkg] = true;
								}
							}
						}
						resolve();
					});
				});
			}
		})(),
	]);

	return result;
}

/**
 * Detects current Android environment.
 * @param {Object} config - The CLI config object
 * @param {Object} opts - Detect options
 * @param {Boolean} [opts.bypassCache=false] - Bypasses the Android environment detection cache and re-queries the system
 */
export async function detect(config, opts = {}) {
	if (envCache && !opts.bypassCache) {
		return envCache;
	}

	const results = {};

	await Promise.all([
		detectJDK(config, opts).then(jdk => results.jdk = jdk),
		detectSDK(config).then(sdk => results.sdk = sdk),
		detectNDK(config).then(ndk => results.ndk = ndk),
		detectLinux64bit(config).then(linux64bit => results.linux64bit = linux64bit),
	]);

	const sdkHome = process.env.ANDROID_SDK_HOME && expand(process.env.ANDROID_SDK_HOME);
	const jdkInfo = results.jdk;

	delete results.jdk;

	results.home               = sdkHome && fs.existsSync(sdkHome) && fs.statSync(sdkHome).isDirectory() ? sdkHome : expand('~/.android');
	results.detectVersion      = '2.0';
	results.vendorDependencies = androidPackageJson.vendorDependencies;
	results.targets            = {};
	results.avds               = [];
	results.issues             = [];

	envCache = results;

	if (!jdkInfo.home) {
		results.issues.push({
			id: 'ANDROID_JDK_NOT_FOUND',
			type: 'error',
			message: `JDK (Java Development Kit) not found.
If you already have installed the JDK, verify your __JAVA_HOME__ environment variable is correctly set.
The JDK can be downloaded and installed from __https://www.oracle.com/java/technologies/downloads/__
or __https://jdk.java.net/archive/__.`
		});
		results.sdk = null;
		return results;
	}

	if (process.platform === 'win32' && jdkInfo.home.includes('&')) {
		results.issues.push({
			id: 'ANDROID_JDK_PATH_CONTAINS_AMPERSANDS',
			type: 'error',
			message: `The JDK (Java Development Kit) path must not contain ampersands (&) on Windows.
Please move the JDK into a path without an ampersand and update the __JAVA_HOME__ environment variable.`
		});
		results.sdk = null;
		return results;
	}

	// if we don't have an android sdk, then nothing else to do
	if (!results.sdk) {
		results.issues.push({
			id: 'ANDROID_SDK_NOT_FOUND',
			type: 'error',
			message: `Unable to locate an Android SDK.
If you have already downloaded and installed the Android SDK, you can tell Titanium where the Android SDK is located by running '__${
commandPrefix
}ti config android.sdkPath /path/to/android-sdk__', otherwise you can install it by running '__${
commandPrefix
}ti setup android__' or manually downloading from ${
`__https://developer.android.com/studio__`
}.`
		});
		return results;
	}

	if (results.sdk.buildTools.tooNew === 'maybe') {
		results.issues.push({
			id: 'ANDROID_BUILD_TOOLS_TOO_NEW',
			type: 'warning',
			message: `
Android Build Tools ${results.sdk.buildTools.version} are too new and may or may not work with Titanium.
If you encounter problems, select a supported version with:
__${commandPrefix} ti config android.buildTools.selectedVersion ##.##.##__
where ##.##.## is a version in ${results.sdk.buildTools.path.split('/').slice(0, -1).join('/')} that is ${results.sdk.buildTools.maxSupported}`
		});
	}

	const createAndroidSdkInstallationErrorMessage = (message) => {
		if (!message) {
			message = '';
		} else if (message.length > 0) {
			message += '\n';
		}
		message += `Current installed Android SDK tools:
Android SDK Tools:          ${results.sdk.tools.version || 'not installed'}  (Supported: ${androidPackageJson.vendorDependencies['android tools']})
Android SDK Platform Tools: ${results.sdk.platformTools.version || 'not installed'}  (Supported: ${androidPackageJson.vendorDependencies['android platform tools']}
Android SDK Build Tools:    ${results.sdk.buildTools.version || 'not installed'}  (Supported: ${androidPackageJson.vendorDependencies['android build tools']}

Make sure you have the latest Android SDK Tools, Platform Tools, and Build Tools installed.
`;
		return message;
	};

	if (!results.sdk.buildTools.supported) {
		results.issues.push({
			id: 'ANDROID_BUILD_TOOLS_NOT_SUPPORTED',
			type: 'error',
			message: createAndroidSdkInstallationErrorMessage(`Android Build Tools ${results.sdk.buildTools.version} are not supported by Titanium`)
		});
	}

	if (results.sdk.buildTools.notInstalled) {
		results.issues.push({
			id: 'ANDROID_BUILD_TOOLS_CONFIG_SETTING_NOT_INSTALLED',
			type: 'error',
			message: createAndroidSdkInstallationErrorMessage(`The selected version of Android SDK Build Tools (${
				results.sdk.buildTools.version
			}) are not installed. Please either remove the setting using ${
				commandPrefix
			} ti config --remove android.buildTools.selectedVersion or install it`)
		});
	}

	// check if we're running Windows and if the sdk path contains ampersands
	if (process.platform === 'win32' && results.sdk.path.includes('&')) {
		results.issues.push({
			id: 'ANDROID_SDK_PATH_CONTAINS_AMPERSANDS',
			type: 'error',
			message: `The Android SDK path must not contain ampersands (&) on Windows.
Please move the Android SDK into a path without an ampersand and re-run __${commandPrefix} ti setup android__.`
		});
		results.sdk = null;
		return results;
	}

	// check if the sdk is missing any commands
	const missing = Object.keys(requiredSdkTools).filter(cmd => !results.sdk.executables[cmd]);
	if (missing.length && results.sdk.buildTools.supported) {
		const dummyPath = path.join(expand('/'), 'path', 'to', 'android-sdk');
		let msg = '';

		if (missing.length) {
			msg += `Missing required Android SDK tool${missing.length !== 1 ? 's' : ''}: __${missing.join(', ')}__\n\n`;
		}

		msg = createAndroidSdkInstallationErrorMessage(msg);

		if (missing.length) {
			msg += '\nYou can also specify the exact location of these required tools by running:\n';
			for (const m of missing) {
				msg += `  ${commandPrefix} ti config android.executables.${m} "${path.join(dummyPath, m + requiredSdkTools[m])}"\n`;
			}
		}

		msg += `\nIf you need to, run "${commandPrefix} ti setup android" to reconfigure the Titanium Android settings.`;

		results.issues.push({
			id: 'ANDROID_SDK_MISSING_PROGRAMS',
			type: 'error',
			message: msg
		});
	}

	/**
	 * Detect system images
	 */
	const systemImages = {};
	const systemImagesByPath = {};
	const systemImagesDir = path.join(results.sdk.path, 'system-images');
	if (isDir(systemImagesDir)) {
		for (const platform of fs.readdirSync(systemImagesDir)) {
			const platformDir = path.join(systemImagesDir, platform);
			if (!isDir(platformDir)) {
				continue;
			}

			for (const tag of fs.readdirSync(platformDir)) {
				const tagDir = path.join(platformDir, tag);
				if (!isDir(tagDir)) {
					continue;
				}

				for (const abi of fs.readdirSync(tagDir)) {
					const abiDir = path.join(tagDir, abi);
					const props = readProps(path.join(abiDir, 'source.properties'));
					if (props && props['AndroidVersion.ApiLevel'] && props['SystemImage.TagId'] && props['SystemImage.Abi']) {
						const id = `android-${props['AndroidVersion.CodeName'] || props['AndroidVersion.ApiLevel']}`;
						const tag = props['SystemImage.TagId'];
						const skinsDir = path.join(abiDir, 'skins');

						if (!systemImages[id]) {
							systemImages[id] = {};
						}
						if (!systemImages[id][tag]) {
							systemImages[id][tag] = [];
						}

						const skins = [];
						if (isDir(skinsDir)) {
							for (const name of fs.readdirSync(skinsDir)) {
								if (isFile(path.join(skinsDir, name, 'hardware.ini'))) {
									skins.push(name);
								}
							}
						}

						systemImages[id][tag].push({
							abi: props['SystemImage.Abi'],
							skins
						});

						systemImagesByPath[path.relative(results.sdk.path, abiDir)] = {
							id: id,
							tag: tag,
							abi: abi
						};
					}
				}
			}
		}
	}

	/**
	 * Detect targets
	 */
	const platformsDir = path.join(results.sdk.path, 'platforms');
	const platforms = [];
	const platformsById = {};
	if (isDir(platformsDir)) {
		for (const name of fs.readdirSync(platformsDir)) {
			const info = loadPlatform(path.join(platformsDir, name), systemImages);
			if (info) {
				platforms.push(info);
				platformsById[info.id] = info;
			}
		}
	}

	const addonsDir = path.join(results.sdk.path, 'add-ons');
	const addons = [];
	if (isDir(addonsDir)) {
		for (const name of fs.readdirSync(addonsDir)) {
			const info = loadAddon(path.join(addonsDir, name), platforms, systemImages);
			if (info) {
				addons.push(info);
			}
		}
	}

	const sortFn = (a, b) => {
		if (a.codename === null) {
			if (b.codename !== null && a.apiLevel === b.apiLevel) {
				// sort GA releases before preview releases
				return -1;
			}
		} else if (a.apiLevel === b.apiLevel) {
			return b.codename === null ? 1 : a.codename.localeCompare(b.codename);
		}

		return a.apiLevel - b.apiLevel;
	};

	let index = 1;
	const sortedPlatforms = platforms.sort(sortFn).concat(addons.sort(sortFn));
	for (const platform of sortedPlatforms) {
		const abis = [];
		if (platform.abis) {
			for (const type of Object.keys(platform.abis)) {
				for (const abi of platform.abis[type]) {
					if (!abis.includes(abi)) {
						abis.push(abi);
					}
				}
			}
		}

		const info = {
			id:          platform.id,
			abis:        abis,
			skins:       platform.skins,
			name:        platform.name,
			type:        platform.type,
			path:        platform.path,
			revision:    platform.revision,
			androidJar:  platform.androidJar,
			aidl:        platform.aidl
		};

		if (platform.type === 'platform') {
			info['api-level'] = platform.apiLevel;
			info.sdk = platform.apiLevel;
			info.version = platform.version;
			info.supported = !~~platform.apiLevel || version.satisfies(platform.apiLevel, androidPackageJson.vendorDependencies['android sdk'], true);
		} else if (platform.type === 'add-on' && platform.basedOn) {
			info.vendor = platform.vendor;
			info.description = platform.description;
			info.version = platform.basedOn.version || Number.parseInt(String(platform.basedOn).replace(/^android-/, '')) || null;
			info['based-on'] = {
				'android-version': platform.basedOn.version,
				'api-level': platform.basedOn.apiLevel
			};
			info.supported = !Number.parseInt(platform.basedOn.apiLevel) || version.satisfies(platform.basedOn.apiLevel, androidPackageJson.vendorDependencies['android sdk'], true);
			info.libraries = {}; // not supported any more
		}

		results.targets[index++] = info;

		if (!info.supported) {
			results.issues.push({
				id: 'ANDROID_API_TOO_OLD',
				type: 'warning',
				message: `Android API __${info.name} (${info.id})__ is too old and is no longer supported by Titanium SDK ${manifestJson.version}
The minimum supported Android API level by Titanium SDK ${manifestJson.version} is API level ${version.parseMin(androidPackageJson.vendorDependencies['android sdk'])}`
			});
		} else if (info.supported === 'maybe') {
			results.issues.push({
				id: 'ANDROID_API_TOO_NEW',
				type: 'warning',
				message: `Android API __${info.name} (${info.id})__ is too new and may or may not work with Titanium SDK ${manifestJson.version}
The maximum supported Android API level by Titanium SDK ${manifestJson.version} is API level ${version.parseMax(androidPackageJson.vendorDependencies['android sdk'])}`
			});
		}
	}

	// check that we found at least one target
	if (!Object.keys(results.targets).length) {
		results.issues.push({
			id: 'ANDROID_NO_APIS',
			type: 'error',
			message: `No Android APIs found.
Run 'Android Studio' to install the latest Android APIs.`
		});
	}

	// check that we found at least one valid target
	if (!Object.keys(results.targets).some(t => !!results.targets[t].supported)) {
		results.issues.push({
			id: 'ANDROID_NO_VALID_APIS',
			type: 'warning',
			message: `No valid Android APIs found that are supported by Titanium SDK ${manifestJson.version}.
Run 'Android Studio' to install the latest Android APIs.`
		});
	}

	// parse the avds
	const avdDir = expand('~/.android/avd');
	const iniRegExp = /^(.+)\.ini$/;
	if (isDir(avdDir)) {
		for (const name of fs.readdirSync(avdDir)) {
			const m = name.match(iniRegExp);
			if (!m) {
				return;
			}

			const ini = readProps(path.join(avdDir, name));
			if (!ini) {
				return;
			}

			let q;
			const p = isDir(ini.path) ? ini.path : (ini['path.rel'] && isDir(q = path.join(avdDir, ini['path.rel'])) ? q : null);
			if (!p) {
				return;
			}

			const config = readProps(path.join(p, 'config.ini'));
			if (!config) {
				return;
			}

			const sdcard = path.join(p, 'sdcard.img');
			let target = null;
			let sdk = null;
			let apiLevel = null;

			const info = config['image.sysdir.1'] && systemImagesByPath[config['image.sysdir.1'].replace(/\/$/, '')];
			if (info) {
				const platform = platformsById[info.id];
				if (platform) {
					target = `${platform.name} (API level ${platform.apiLevel})`;
					sdk = platform.version;
					apiLevel = platform.apiLevel;
				}
			}

			results.avds.push({
				type:          'avd',
				id:            config['AvdId'] || m[1],
				name:          config['avd.ini.displayname'] || m[1],
				device:        `${config['hw.device.name']} (${config['hw.device.manufacturer']})`,
				path:          p,
				target:        target,
				abi:           config['abi.type'],
				skin:          config['skin.name'],
				sdcard:        config['hw.sdCard'] === 'yes' && isFile(sdcard) ? sdcard : null,
				googleApis:    config['tag.id'] === 'google_apis',
				'sdk-version': sdk,
				'api-level':   apiLevel
			});
		}
	}

	return results;
}

export async function findSDK(dir, config, androidPackageJson) {
	if (!dir) {
		return null;
	}

	dir = expand(dir);

	// check if the supplied directory exists and is actually a directory
	if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
		return null;
	}

	const emulatorPath = path.join(dir, 'emulator', `emulator${exe}`);
	const result = {
		path: dir,
		executables: {
			adb:       path.join(dir, 'platform-tools', 'adb' + exe),
			emulator:  fs.existsSync(emulatorPath) ? emulatorPath : path.join(dir, 'emulator', 'emulator' + exe)
		},
		proguard: null,
		tools: {
			path: null,
			supported: null,
			version: null
		},
		platformTools: {
			path: null,
			supported: null,
			version: null
		},
		buildTools: {
			path: null,
			supported: null,
			version: null,
			tooNew: null,
			maxSupported: null
		}
	};
	const buildToolsDir = path.join(dir, 'build-tools');

	/*
		Determine build tools version to use based on either config setting
		(android.buildTools.selectedVersion) or latest version
	*/
	let buildToolsSupported = false;
	if (fs.existsSync(buildToolsDir)) {
		let ver = config.get('android.buildTools.selectedVersion');
		if (!ver) {
			// No selected version, so find the newest, supported build tools version
			const ignoreDirs = new RegExp(config.get('cli.ignoreDirs'));
			const ignoreFiles = new RegExp(config.get('cli.ignoreFiles'));
			const files = fs.readdirSync(buildToolsDir).sort().reverse().filter(item => !(ignoreFiles.test(item) || ignoreDirs.test(item)));
			const len = files.length;
			let i = 0;
			for (; i < len; i++) {
				const isSupported = version.satisfies(files[i], androidPackageJson.vendorDependencies['android build tools'], true);
				if (isSupported) {
					buildToolsSupported = isSupported;
					ver = files[i];
					if (buildToolsSupported === true) {
						// The version found is fully supported (not set to 'maybe'). So, stop here.
						break;
					}
				}
			}

			// If we've failed to find a build-tools version that Titanium supports up above,
			// then grab the newest old version installed to be logged as unsupported later.
			if (!ver && (len > 0)) {
				ver = files[len - 1];
				buildToolsSupported = false;
			}
		}
		if (ver) {
			// A selectedVersion specified or supported version has been found
			let file = path.join(buildToolsDir, ver, 'source.properties');
			if (fs.existsSync(file) && fs.statSync(path.join(buildToolsDir, ver)).isDirectory()) {
				const m = fs.readFileSync(file, 'utf8').match(/Pkg\.Revision\s*?=\s*?([^\s]+)/);
				if (m) {
					result.buildTools = {
						path: path.join(buildToolsDir, ver),
						supported: version.satisfies(m[1], androidPackageJson.vendorDependencies['android build tools'], true),
						version: m[1],
						tooNew: buildToolsSupported,
						maxSupported: version.parseMax(androidPackageJson.vendorDependencies['android build tools'], true)
					};
				}
			} else {
				// build tools don't exist at the given location
				result.buildTools = {
					path: path.join(buildToolsDir, ver),
					notInstalled: true,
					version: ver
				};
			}
		}
	}

	// see if this sdk has all the executables we need
	const tasks = {};
	for (const cmd of Object.keys(requiredSdkTools)) {
		tasks[cmd] = (async () => {
			let bin = config.get(`android.executables.${cmd}`);
			if (bin) {
				bin = await which(bin, { nothrow: true });
			}
			if (!bin) {
				bin = await which(result.executables[cmd], { nothrow: true });
			}
			if (!bin) {
				throw new Error(`Unable to find "${cmd}" executable`);
			}
			return { [cmd]: bin };
		})();
	}

	const executables = await Promise.all(Object.values(tasks));
	Object.assign(result.executables, executables);

	// check that we have all required sdk programs
	if (Object.keys(requiredSdkTools).every(cmd => !executables[cmd])) {
		return null;
	}

	const file = path.join(dir, 'platform-tools', 'source.properties');

	// check if this directory contains an android sdk
	if (!fs.existsSync(executables.adb) || !fs.existsSync(file)) {
		return null;
	}

	if (fs.existsSync(file)) {
		const m = fs.readFileSync(file, 'utf8').match(/Pkg\.Revision\s*?=\s*?([^\s]+)/);
		if (m) {
			result.platformTools = {
				path: path.join(dir, 'platform-tools'),
				supported: version.satisfies(m[1], androidPackageJson.vendorDependencies['android platform tools'], true),
				version: m[1]
			};
		}
	}

	return result;
}

function findNDK(dir) {
	if (!dir) {
		return null;
	}

	// check if the supplied directory exists and is actually a directory
	dir = expand(dir);

	if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
		return null;
	}

	// check that the ndk files/folders exist
	const things = [ `ndk-build${cmd}`, 'build', 'prebuilt', 'platforms' ];
	if (!things.every(thing => fs.existsSync(path.join(dir, thing)))) {
		return null;
	}

	// try to determine the version
	let version;
	const sourceProps = path.join(dir, 'source.properties');
	if (fs.existsSync(sourceProps)) {
		const m = fs.readFileSync(sourceProps, 'utf8').match(/Pkg\.Revision\s*=\s*(.+)/m);
		if (m?.[1]) {
			version = m[1].trim();
		}
	}

	if (!version) {
		// try the release.txt
		let releasetxt;
		for (const file of fs.readdirSync(dir)) {
			if (file.toLowerCase() === 'release.txt') {
				releasetxt = path.join(dir, file);
				break;
			}
		}
		if (releasetxt && fs.existsSync(releasetxt)) {
			version = fs.readFileSync(releasetxt, 'utf8').split(/\r?\n/).shift().trim();
		}
	}

	if (!version) {
		// no version, not an ndk
		return null;
	}

	return {
		path: dir,
		executables: {
			ndkbuild: path.join(dir, 'ndk-build' + cmd)
		},
		version: version
	};
}

function isDir(dir) {
	try {
		return fs.statSync(dir).isDirectory();
	} catch {
		// squeltch
	}
	return false;
}

function isFile(file) {
	try {
		return fs.statSync(file).isFile();
	} catch {
		// squeltch
	}
	return false;
}

function readProps(file) {
	if (!isFile(file)) {
		return null;
	}

	const props = {};
	for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
		const m = line.match(pkgPropRegExp);
		if (m) {
			props[m[1].trim()] = m[2].trim();
		}
	}

	return props;
}

function loadPlatform(dir, systemImages) {
	// read in the properties
	const sourceProps = readProps(path.join(dir, 'source.properties'));
	const apiLevel = sourceProps ? Number.parseInt(sourceProps['AndroidVersion.ApiLevel']) : null;
	if (!sourceProps || !apiLevel || !isFile(path.join(dir, 'build.prop'))) {
		return null;
	}

	// read in the sdk properties, if exists
	const sdkProps = readProps(path.join(dir, 'sdk.properties'));

	// detect the available skins
	const skinsDir = path.join(dir, 'skins');
	const skins = [];
	if (isDir(skinsDir)) {
		for (const name of fs.readdirSync(skinsDir)) {
			if (isFile(path.join(skinsDir, name, 'hardware.ini'))) {
				skins.push(name);
			}
		}
	}

	let defaultSkin = sdkProps?.['sdk.skin.default'];
	if (defaultSkin && !skins.includes(defaultSkin)) {
		defaultSkin = 'WVGA800';
	}
	if (defaultSkin && !skins.includes(defaultSkin)) {
		defaultSkin = skins[skins.length - 1] || null;
	}

	const apiName = sourceProps['AndroidVersion.CodeName'] || apiLevel;
	const id = `android-${apiName}`;

	const abis = {};
	if (systemImages[id]) {
		for (const type of Object.keys(systemImages[id])) {
			for (const info of systemImages[id][type]) {
				if (!abis[type]) {
					abis[type] = [];
				}
				abis[type].push(info.abi);
				for (const skin of info.skins) {
					if (!skins.includes(skin)) {
						skins.push(skin);
					}
				}
			}
		}
	}

	let tmp;
	return {
		id:          id,
		name:        `Android ${sourceProps['Platform.Version']} ${sourceProps['AndroidVersion.CodeName'] ? ' (Preview)' : ''}`,
		type:        'platform',
		apiLevel:    apiLevel,
		codename:    sourceProps['AndroidVersion.CodeName'] || null,
		revision:    Number.parseInt(sourceProps['Layoutlib.Revision']) || null,
		path:        dir,
		version:     sourceProps['Platform.Version'],
		abis:        abis,
		skins:       skins,
		defaultSkin: defaultSkin,
		minToolsRev: Number.parseInt(sourceProps['Platform.MinToolsRev']) || null,
		androidJar:  isFile(tmp = path.join(dir, 'android.jar')) ? tmp : null,
		aidl:        isFile(tmp = path.join(dir, 'framework.aidl')) ? tmp : null
	};
}

function loadAddon(dir, platforms, _systemImages) {
	// read in the properties
	const sourceProps = readProps(path.join(dir, 'source.properties'));
	const apiLevel = sourceProps ? Number.parseInt(sourceProps['AndroidVersion.ApiLevel']) : null;
	if (!sourceProps || !apiLevel || !sourceProps['Addon.VendorDisplay'] || !sourceProps['Addon.NameDisplay']) {
		return null;
	}

	const basedOn = platforms.find(p => p.codename === null && p.apiLevel === apiLevel);

	return {
		id:          `${sourceProps['Addon.VendorDisplay']}:${sourceProps['Addon.NameDisplay']}:${apiLevel}`,
		name:        sourceProps['Addon.NameDisplay'],
		type:        'add-on',
		vendor:      sourceProps['Addon.VendorDisplay'],
		description: sourceProps['Pkg.Desc'],
		apiLevel:    apiLevel,
		revision:    Number.parseInt(sourceProps['Pkg.Revision']) || null,
		codename:    sourceProps['AndroidVersion.CodeName'] || null,
		path:        dir,
		basedOn:     basedOn ? {
			version: basedOn.version,
			apiLevel: basedOn.apiLevel
		} : null,
		abis:        basedOn && basedOn.abis || null,
		skins:       basedOn && basedOn.skins || null,
		defaultSkin: basedOn && basedOn.defaultSkin || null,
		minToolsRev: basedOn && basedOn.minToolsRev || null,
		androidJar:  basedOn && basedOn.androidJar || null,
		aidl:        basedOn && basedOn.aidl || null
	};
}

function versionStringComparer(text1, text2) {
	// Split strings into version component arrays. Example: '1.2.3' -> ['1', '2', '3']
	const array1 = text1.split('.');
	const array2 = text2.split('.');

	// Compare the 2 given strings by their numeric components.
	// If they match numerically, then do a string comparison.
	const maxLength = Math.max(array1.length, array2.length);
	for (let index = 0; index < maxLength; index++) {
		const value1 = (index < array1.length) ? (Number.parseInt(array1[index]) || 0) : 0;
		const value2 = (index < array2.length) ? (Number.parseInt(array2[index]) || 0) : 0;
		const delta = value1 - value2;
		if (delta !== 0) {
			return delta;
		}
	}
	return text1.localeCompare(text2);
}
