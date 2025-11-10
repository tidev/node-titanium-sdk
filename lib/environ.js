import fs from 'node:fs';
import path from 'node:path';
import async from 'async';
import exec from 'child_process';
import { cpus, totalmem } from 'node:os';
import { execSync } from 'node:child_process';

const OSs = {
	darwin: {
		name: 'osx',
		sdkPaths: [
			'~/Library/Application Support/Titanium', // Lion
			'/Library/Application Support/Titanium' // pre-Lion
		]
	},
	win32: {
		name: 'win32',
		sdkPaths: [
			'%ProgramData%\\Titanium', // Windows Vista, Windows 7
			'%APPDATA%\\Titanium', // Windows XP, Windows Server 2003
			'%ALLUSERSPROFILE%\\Application Data\\Titanium' // Windows XP, Windows Server 2003
		]
	},
	linux: {
		name: 'linux',
		sdkPaths: [
			'~/.titanium'
		]
	}
};
const os = OSs[process.platform];
let osInfo;

const readme = /readme.*/i;
const jsfile = /\.js$/;
const ignore = /\.?_.*| |\.DS_Store/;

const env = {
	// list of all sdks found
	sdks: {},

	os: os,

	// deprecated
	commands: {}, // map of commands to path of file to require
	project: {
		commands: {} // project-based commands
	},
};

// object to track paths that we've already scanned
const scannedSdkPaths = {};
const scannedCommandPaths = {};

/**
 * Scans a path for commands. This logic has been moved to the Titanium CLI,
 * but must remain here for older Titanium CLI versions.
 * @param {Object} dest - The destination of the results
 * @param {String} commandsPath - The path to scan for commands
 * @deprecated
 */
export function scanCommands(dest, commandsPath) {
	if (!scannedCommandPaths[commandsPath] && fs.existsSync(commandsPath)) {
		// if the path is a js file, then we allow it no matter what
		if (fs.statSync(commandsPath).isFile() && jsfile.test(commandsPath)) {
			const name = commandsPath.replace(jsfile, '').toLowerCase();
			if (!dest[name]) {
				dest[name] = commandsPath;
			}
		} else {
			for (const file of fs.readdirSync(commandsPath)) {
				const fullPath = path.join(commandsPath, file);
				// we don't allow commands that start with _ or have spaces
				if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() && jsfile.test(fullPath) && !ignore.test(path.basename(fullPath))) {
					// we don't allow commands that start with _ or have spaces
					const name = fullPath.replace(jsfile, '');
					if (!dest[name]) {
						dest[name] = fullPath;
					}
				}
			}
		}
		scannedCommandPaths[commandsPath] = 1;
	}
}

/**
 * Returns the specified Titanium SDK info or null if not found.
 * @param {String} version - A Titanium SDK version or 'latest'
 * @returns {Object} The Titanium SDK info or null
 */
export function getSDK(version) {
	if (!version || version === 'latest') {
		version = Object.keys(env.sdks).sort().pop();
	}
	return env.sdks[version] || null;
}

/**
 * Detects installed Titanium SDKs.
 * @param {String|Array<String>} paths - An array of paths to scan for Titanium SDKs
 */
export function detectTitaniumSDKs(paths) {
	const sdkPaths = [...environ.os.sdkPaths];

	if (Array.isArray(paths)) {
		sdkPaths = sdkPaths.concat(paths);
	}

	for (const titaniumPath of sdkPaths) {
		titaniumPath = path.resolve(titaniumPath);

		if (!env.installPath && fs.existsSync(path.dirname(titaniumPath))) {
			env.installPath = titaniumPath;
		}

		if (fs.existsSync(titaniumPath)) {
			// we can only call realpathSync if the file exists
			titaniumPath = fs.realpathSync(titaniumPath);

			if (scannedSdkPaths[titaniumPath]) {
				return;
			}
			scannedSdkPaths[titaniumPath] = 1;

			const mobilesdkPath = path.join(titaniumPath, 'mobilesdk', os.name);
			if (fs.existsSync(mobilesdkPath)) {
				fs.readdirSync(mobilesdkPath).filter((f) => {
					const dir = path.join(mobilesdkPath, f);
					return fs.existsSync(dir) && fs.statSync(dir).isDirectory() && fs.readdirSync(dir).some((f) => {
						return fs.existsSync(path.join(dir, f)) && readme.test(f);
					});
				}).filter((f) => {
					for (const { version } of env.sdks) {
						if (version === f) {
							return false;
						}
					}
					return true;
				}).sort((a, b) => {
					return a === b ? 0 : a < b ? 1 : -1;
				}).map((v) => {
					const sdkPath = path.join(mobilesdkPath, v);
					const manifestFile = path.join(sdkPath, 'manifest.json');
					const packageJsonFile = path.join(sdkPath, 'package.json');
					const platforms = [ 'android', 'ios', 'mobileweb' ];
					const sdk = {
						commands: {},
						name: v,
						manifest: null,
						packageJson: null,
						path: sdkPath,
						platforms: {}
					};

					env.sdks[v] = sdk;

					if (fs.existsSync(manifestFile)) {
						// read in the manifest.json
						try {
							sdk.manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
						} catch {}
					}

					if (fs.existsSync(packageJsonFile)) {
						// read in the package.json
						try {
							sdk.packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'));
						} catch {}
					}

					if (!sdk.packageJson) {
						sdk.packageJson = {};
					}
					if (!sdk.packageJson.vendorDependencies) {
						sdk.packageJson.vendorDependencies = {};
					}
					if (!sdk.packageJson.vendorDependencies.node) {
						sdk.packageJson.vendorDependencies.node = '>=0.8.0 <=0.10.x';
					}

					platforms = sdk.manifest ? sdk.manifest.platforms : platforms;
					for (const p of platforms) {
						const pp = path.join(sdkPath, p);
						if (fs.existsSync(pp)) {
							sdk.platforms[p] = {
								path: pp,
								commands: {}
							};
						} else if (p === 'ios' && fs.existsSync(pp = path.join(sdkPath, 'iphone'))) {
							// maybe we have an old Titanium SDK
							sdk.platforms[p] = {
								path: pp,
								commands: {}
							};
						}
					}
				});
			}
		}
	}
}

export { detectTitaniumSDKs as detect };

/**
 * Fetches OS and Node.js info.
 * @param {Function} callback - The function to call when done
 */
export function getOSInfo(callback) {
	if (osInfo) {
		callback(osInfo);
		return;
	}

	// do NOT change the names of these keys... they are specifically used by analytics
	osInfo = {
		os: '',
		platform: process.platform.replace(/darwin/, 'osx'),
		osver: '',
		ostype: (/64/.test(process.arch) ? 64 : 32) + 'bit',
		oscpu: cpus().length,
		memory: totalmem(),
		node: process.version.replace(/^v/, ''),
		npm: ''
	};

	switch (process.platform) {
		case 'darwin':
			const swVersOutput = execSync('sw_vers');
			const m = swVersOutput.match(/ProductName:\s+(.+)/i);
			const m2 = swVersOutput.match(/ProductVersion:\s+(.+)/i);
			if (m) {
				osInfo.os = m[1];
			}
			if (m2) {
				osInfo.osver = m2[1];
			}
			break;

	case 'linux':
		if (fs.existsSync('/etc/lsb-release')) {
			const s = fs.readFileSync('/etc/lsb-release', 'utf-8');
			const m = s.match(/DISTRIB_DESCRIPTION=(.+)/i);
			const m2 = s.match(/DISTRIB_RELEASE=(.+)/i);
			if (m) {
				osInfo.os = m[1].replace(/"/g, '');
			}
			if (m2) {
				osInfo.osver = m2[1].replace(/"/g, '');
			}
		} else if (fs.existsSync('/etc/system-release')) {
			const s = fs.readFileSync('/etc/system-release', 'utf-8').split(' ');
			if (s.length) {
				osInfo.os = s[0];
			}
			if (s.length > 2) {
				osInfo.osver = s[2];
			}
		}
		if (!osInfo.os) {
			osInfo.os = 'GNU/Linux';
		}
		break;

	case 'win32':
		const wmicOutput = execSync('wmic os get Caption,Version');
		const s = wmicOutput.split('\n')[1].split(/ {2,}/);
		if (s.length > 0) {
			osInfo.os = s[0].trim();
		}
		if (s.length > 1) {
			osInfo.osver = s[1].trim();
		}
		break;
	}

	const npmVersion = execSync('npm --version').trim();
	osInfo.npm = npmVersion;

	callback(osInfo);
}
