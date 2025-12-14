import { config } from '../config.js';
import { expand } from '../util/expand.js';
import { createHash } from 'node:crypto';
import { tailgate } from '../util/tailgate.js';
import snooplogg from 'snooplogg';
import { isDir } from '../util/is-dir.js';
import { join } from 'node:path';
import { readPropertiesFile } from './util/read-properties-file.js';
import { isFile } from '../util/is-file.js';
import { readdir } from 'node:fs/promises';

const { error, log } = snooplogg('android:sdk');

const bat = process.platform === 'win32' ? '.bat' : '';
const exe = process.platform === 'win32' ? '.exe' : '';

interface AndroidSDKExecutables {
	adb: string;
	android: string;
	emulator: string;
}

export class AndroidSDK {
	buildTools: Record<string, string>;
	executables: AndroidSDKExecutables;
	path: string;
	version: string;

	constructor({
		buildTools,
		executables,
		path,
		version
	}: {
		buildTools: Record<string, string>;
		executables: AndroidSDKExecutables;
		path: string;
		version: string;
	}) {
		this.buildTools = buildTools;
		this.executables = executables;
		this.path = path;
		this.version = version;
	}

	static async load(path: string): Promise<AndroidSDK> {
		log(`Loading: ${path}`);
		if (typeof path !== 'string' || !path) {
			throw new TypeError('Expected Android SDK path to be a valid string');
		}
		if (!isDir(path)) {
			throw new Error('Android SDK path does not exist: ${path}');
		}

		const executables = {
			adb:        join(path, 'platform-tools', `adb${exe}`),
			android:    join(path, 'tools', `android${bat}`),
			emulator:   join(path, 'tools', `emulator${exe}`),
		};

		const buildTools: Record<string, string> = {};
		for (const ver of await readdir(join(path, 'build-tools'))) {
			const dir = join(path, 'build-tools', ver);
			if (isFile(join(dir, 'source.properties'))) {
				buildTools[ver] = dir;
			}
		}

		const systemImagesDir = join(path, 'system-images');

		// /**
		//  * Detect system images
		//  */
		// const systemImagesDir = path.join(dir, 'system-images');
		// if (isDir(systemImagesDir)) {
		// 	for (const platform of fs.readdirSync(systemImagesDir)) {
		// 		const platformDir = path.join(systemImagesDir, platform);
		// 		if (isDir(platformDir)) {
		// 			for (const tag of fs.readdirSync(platformDir)) {
		// 				const tagDir = path.join(platformDir, tag);
		// 				if (isDir(tagDir)) {
		// 					for (const abi of fs.readdirSync(tagDir)) {
		// 						const abiDir = path.join(tagDir, abi);
		// 						const props = readPropertiesFile(path.join(abiDir, 'source.properties'));
		// 						if (props && props['AndroidVersion.ApiLevel'] && props['SystemImage.TagId'] && props['SystemImage.Abi']) {
		// 							const imageDir = path.relative(systemImagesDir, abiDir).replace(/\\/g, '/');
		// 							const skinsDir = path.join(abiDir, 'skins');

		// 							this.systemImages[imageDir] = {
		// 								abi: props['SystemImage.Abi'],
		// 								sdk: `android-${props['AndroidVersion.CodeName'] || props['AndroidVersion.ApiLevel']}`,
		// 								skins: isDir(skinsDir) ? fs.readdirSync(skinsDir).map(name => {
		// 									return isFile(path.join(skinsDir, name, 'hardware.ini')) ? name : null;
		// 								}).filter(x => x) : [],
		// 								type: props['SystemImage.TagId']
		// 							};
		// 						}
		// 					}
		// 				}
		// 			}
		// 		}
		// 	}
		// }

		// /**
		//  * Detect platforms
		//  */
		// const platformsDir = path.join(dir, 'platforms');
		// if (isDir(platformsDir)) {
		// 	for (const name of fs.readdirSync(platformsDir)) {
		// 		const dir = path.join(platformsDir, name);
		// 		const sourceProps = readPropertiesFile(path.join(dir, 'source.properties'));
		// 		const apiLevel = sourceProps ? ~~sourceProps['AndroidVersion.ApiLevel'] : null;
		// 		if (!sourceProps || !apiLevel || !isFile(path.join(dir, 'build.prop'))) {
		// 			continue;
		// 		}

		// 		// read in the sdk properties, if exists
		// 		const sdkProps = readPropertiesFile(path.join(dir, 'sdk.properties'));

		// 		// detect the available skins
		// 		const skinsDir = path.join(dir, 'skins');
		// 		const skins = isDir(skinsDir) ? fs.readdirSync(skinsDir).map(name => {
		// 			return isFile(path.join(skinsDir, name, 'hardware.ini')) ? name : null;
		// 		}).filter(x => x) : [];
		// 		let defaultSkin = sdkProps && sdkProps['sdk.skin.default'];
		// 		if (skins.indexOf(defaultSkin) === -1 && skins.indexOf(defaultSkin = 'WVGA800') === -1) {
		// 			defaultSkin = skins[skins.length - 1] || null;
		// 		}

		// 		const apiName = sourceProps['AndroidVersion.CodeName'] || apiLevel;
		// 		const sdk = `android-${apiName}`;
		// 		let tmp;

		// 		const abis = {};
		// 		for (const image of Object.values(this.systemImages)) {
		// 			if (image.sdk === sdk) {
		// 				if (!abis[image.type]) {
		// 					abis[image.type] = [];
		// 				}
		// 				if (!abis[image.type].includes(image.abi)) {
		// 					abis[image.type].push(image.abi);
		// 				}

		// 				for (const skin of image.skins) {
		// 					if (!skins.includes(skin)) {
		// 						skins.push(skin);
		// 					}
		// 				}
		// 			}
		// 		}

		// 		this.platforms.push({
		// 			abis:        abis,
		// 			aidl:        isFile(tmp = path.join(dir, 'framework.aidl')) ? tmp : null,
		// 			androidJar:  isFile(tmp = path.join(dir, 'android.jar')) ? tmp : null,
		// 			apiLevel:    apiLevel,
		// 			codename:    sourceProps['AndroidVersion.CodeName'] || null,
		// 			defaultSkin: defaultSkin,
		// 			minToolsRev: +sourceProps['Platform.MinToolsRev'] || null,
		// 			name:        `Android ${sourceProps['Platform.Version']}${sourceProps['AndroidVersion.CodeName'] ? ' (Preview)' : ''}`,
		// 			path:        dir,
		// 			revision:    +sourceProps['Layoutlib.Revision'] || null,
		// 			sdk,
		// 			skins:       skins,
		// 			version:     sourceProps['Platform.Version']
		// 		});
		// 	}
		// }

		// /**
		//  * Detect addons
		//  */
		// const addonsDir = path.join(dir, 'add-ons');
		// if (isDir(addonsDir)) {
		// 	for (const name of fs.readdirSync(addonsDir)) {
		// 		const dir = path.join(addonsDir, name);
		// 		const props = readPropertiesFile(path.join(dir, 'source.properties')) || readPropertiesFile(path.join(dir, 'manifest.ini'));
		// 		if (!props) {
		// 			continue;
		// 		}

		// 		const apiLevel = parseInt(props['AndroidVersion.ApiLevel'] || props.api);
		// 		const vendorDisplay = props['Addon.VendorDisplay'] || props.vendor;
		// 		const nameDisplay = props['Addon.NameDisplay'] || props.name;
		// 		if (!apiLevel || isNaN(apiLevel) || !vendorDisplay || !nameDisplay) {
		// 			continue;
		// 		}

		// 		let basedOn = null;
		// 		for (const platform of this.platforms) {
		// 			if (platform.codename === null && platform.apiLevel === apiLevel) {
		// 				basedOn = platform;
		// 				break;
		// 			}
		// 		}

		// 		this.addons.push({
		// 			abis:        basedOn && basedOn.abis || null,
		// 			aidl:        basedOn && basedOn.aidl || null,
		// 			androidJar:  basedOn && basedOn.androidJar || null,
		// 			apiLevel:    apiLevel,
		// 			basedOn:     basedOn ? { version: basedOn.version, apiLevel: basedOn.apiLevel } : null,
		// 			codename:    props['AndroidVersion.CodeName'] || props.codename || null,
		// 			defaultSkin: basedOn && basedOn.defaultSkin || null,
		// 			description: props['Pkg.Desc'] || props.description || null,
		// 			minToolsRev: basedOn && basedOn.minToolsRev || null,
		// 			name:        nameDisplay,
		// 			path:        dir,
		// 			revision:    parseInt(props['Pkg.Revision'] || props.revision) || null,
		// 			sdk:         `${vendorDisplay}:${nameDisplay}:${apiLevel}`,
		// 			skins:       basedOn && basedOn.skins || null,
		// 			vendor: 	 vendorDisplay,
		// 			version:	 basedOn && basedOn.version || null
		// 		});
		// 	}
		// }

		// function sortFn(a, b) {
		// 	if (a.codename === null) {
		// 		if (b.codename !== null && a.apiLevel === b.apiLevel) {
		// 			// sort GA releases before preview releases
		// 			return -1;
		// 		}
		// 	} else if (a.apiLevel === b.apiLevel) {
		// 		return b.codename === null ? 1 : a.codename.localeCompare(b.codename);
		// 	}

		// 	return a.apiLevel - b.apiLevel;
		// }

		// this.platforms.sort(sortFn);
		// this.addons.sort(sortFn);

		return new AndroidSDK({
			buildTools,
			executables,
			path,
			version: ''
		});
	}
}

let sdkCache: AndroidSDK[] | null = null;
let sdkSearchPathsHash: string | null = null;

export async function detect(options: {
	bypassCache?: boolean;
	searchPaths?: string[];
} = {}): Promise<AndroidSDK[]> {
	const searchPaths = await getSearchPaths(options);
	const searchPathsHash = createHash('sha256')
		.update(searchPaths.toSorted().join()).digest('hex');

	if (sdkCache !== null && !options.bypassCache && sdkSearchPathsHash === searchPathsHash) {
		return sdkCache;
	}

	return tailgate('android:ndk:detect', async () => {
		return [];
	});
}

function findExecutables<T extends Record<string, string>>(dir: string, exes: T): Record<keyof T, string> {
	const executables: Record<string, string> = {};
	for (const [ name, exe ] of Object.entries(exes)) {
		const p = join(dir, exe);
		if (isFile(p)) {
			executables[name] = p;
		}
	}
	return executables as Record<keyof T, string>;
}

async function getSearchPaths(options: { searchPaths?: string[] }) {
	const paths: string[] = [];
	if (Array.isArray(options.searchPaths)) {
		paths.push(...options.searchPaths);
	}
	const configPaths = config.android.ndk.searchPaths[process.platform];
	if (Array.isArray(configPaths)) {
		paths.push(...configPaths);
	}

	const searchPaths = new Set<string>();
	if (paths) {
		for (const path of paths) {
			searchPaths.add(expand(path));
		}
	}

	return Array.from(searchPaths);
}
