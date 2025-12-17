import { config } from '../config.js';
import { expand } from '../util/expand.js';
import { createHash } from 'node:crypto';
import { tailgate } from '../util/tailgate.js';
import snooplogg from 'snooplogg';
import { isDir } from '../util/is-dir.js';
import { join, relative } from 'node:path';
import { readPropertiesFile } from './util/read-properties-file.js';
import { isFile } from '../util/is-file.js';
import { readdir } from 'node:fs/promises';
import { Issue } from '../util/issue.js';

const { error, log } = snooplogg('android:sdk');

const bat = process.platform === 'win32' ? '.bat' : '';
const exe = process.platform === 'win32' ? '.exe' : '';

type AndroidSDKExecutables = {
	adb: string;
	android: string;
	emulator: string;
};

type SystemImage = {
	abi: string;
	sdk: string;
	skins: string[];
	type: string;
};

type Platform = {
	abis: Record<string, string[]>;
	androidJar: string | null;
	apiLevel: number;
	codename: string | null;
	defaultSkin: string | null;
	minToolsRev: number | null;
	name: string;
	path: string;
	revision: number | null;
	sdk: string;
	skins: string[];
	version: string;
};

type Addon = {
	abis: Record<string, string[]> | null;
	androidJar: string | null;
	apiLevel: number;
	basedOn: { version: string; apiLevel: number } | null;
	codename: string | null;
	defaultSkin: string | null;
	description: string | null;
	minToolsRev: number | null;
	name: string;
	path: string;
	revision: number | null;
	sdk: string;
	skins: string[] | null;
	vendor: string;
	version: string | null;
};

type AndroidSDKOptions = {
	addons: Addon[];
	buildTools: Record<string, string>;
	executables: AndroidSDKExecutables;
	path: string;
	systemImages: Record<string, SystemImage>;
	version: string;
};

export class AndroidSDK {
	addons!: Addon[];
	buildTools!: Record<string, string>;
	executables!: AndroidSDKExecutables;
	path!: string;
	systemImages!: Record<string, SystemImage>;
	version!: string;

	constructor(options: AndroidSDKOptions) {
		Object.assign(this, options);
	}

	static async load(path: string): Promise<AndroidSDK> {
		log(`Loading: ${path}`);
		if (typeof path !== 'string' || !path) {
			throw new TypeError('Expected Android SDK path to be a valid string');
		}
		if (!isDir(path)) {
			throw new Error(`Android SDK path does not exist: ${path}`);
		}

		const executables = {
			adb:        join(path, 'platform-tools', `adb${exe}`),
			android:    join(path, 'tools', `android${bat}`),
			emulator:   join(path, 'tools', `emulator${exe}`),
		};
		for (const [key, value] of Object.entries(executables)) {
			if (!isFile(value)) {
				executables[key] = '';
			}
		}

		const buildTools: Record<string, string> = {};
		for (const ver of await readdir(join(path, 'build-tools'))) {
			const dir = join(path, 'build-tools', ver);
			if (isFile(join(dir, 'source.properties'))) {
				buildTools[ver] = dir;
			}
		}

		const systemImages = await AndroidSDK.detectSystemImages(path);
		const platforms = await AndroidSDK.detectPlatforms(path, systemImages);
		const addons = await AndroidSDK.detectAddons(path, platforms);

		return new AndroidSDK({
			addons,
			buildTools,
			executables,
			path,
			systemImages,
			version: ''
		});
	}

	static async detectSystemImages(path: string): Promise<Record<string, SystemImage>> {
		const systemImages: Record<string, SystemImage> = {};
		const systemImagesDir = join(path, 'system-images');

		if (!isDir(systemImagesDir)) {
			return systemImages;
		}

		for (const platform of await readdir(systemImagesDir)) {
			const platformDir = join(systemImagesDir, platform);
			if (!isDir(platformDir)) {
				continue;
			}

			for (const tag of await readdir(platformDir)) {
				const tagDir = join(platformDir, tag);
				if (!isDir(tagDir)) {
					continue;
				}

				for (const abi of await readdir(tagDir)) {
					const abiDir = join(tagDir, abi);
					if (!isDir(abiDir)) {
						continue;
					}

					const props = await readPropertiesFile(join(abiDir, 'source.properties'));
					if (props?.['AndroidVersion.ApiLevel'] && props['SystemImage.TagId'] && props['SystemImage.Abi']) {
						const imageDir = relative(systemImagesDir, abiDir).replace(/\\/g, '/');
						const skinsDir = join(abiDir, 'skins');
						const skins: string[] = [];
						if (isDir(skinsDir)) {
							for (const name of await readdir(skinsDir)) {
								if (isFile(join(skinsDir, name, 'hardware.ini'))) {
									skins.push(name);
								}
							}
						}
						systemImages[imageDir] = {
							abi: props['SystemImage.Abi'],
							sdk: `android-${props['AndroidVersion.CodeName'] || props['AndroidVersion.ApiLevel']}`,
							skins,
							type: props['SystemImage.TagId']
						};
					}
				}
			}
		}

		return systemImages;
	}

	static async detectPlatforms(path: string, systemImages: Record<string, SystemImage>): Promise<Platform[]> {
		const platforms: Platform[] = [];
		const platformsDir = join(path, 'platforms');
		if (!isDir(platformsDir)) {
			return platforms;
		}

		for (const name of await readdir(platformsDir)) {
			const dir = join(platformsDir, name);
			if (!isFile(join(dir, 'build.prop'))) {
				continue;
			}

			const sourceProps = await readPropertiesFile(join(dir, 'source.properties'));
			if (!sourceProps) {
				continue;
			}

			const apiLevel = sourceProps['AndroidVersion.ApiLevel']
				? Number.parseInt(sourceProps['AndroidVersion.ApiLevel'])
				: null;
			if (!apiLevel) {
				continue;
			}

			// read in the sdk properties, if exists
			const sdkProps = await readPropertiesFile(join(dir, 'sdk.properties'));

			// detect the available skins
			const skinsDir = join(dir, 'skins');
			const skins: string[] = [];
			if (isDir(skinsDir)) {
				for (const name of await readdir(skinsDir)) {
					if (isFile(join(skinsDir, name, 'hardware.ini'))) {
						skins.push(name);
					}
				}
			}
			let defaultSkin: string | null = sdkProps?.['sdk.skin.default'] ?? 'WVGA800';
			if (defaultSkin && skins.includes(defaultSkin) && !skins.includes('WVGA800')) {
				defaultSkin = skins[skins.length - 1] || null;
			}

			const apiName = sourceProps?.['AndroidVersion.CodeName'] || apiLevel;
			const sdk = `android-${apiName}`;

			const abis: Record<string, string[]> = {};
			for (const image of Object.values(systemImages)) {
				if (image.sdk === sdk) {
					if (!abis[image.type]) {
						abis[image.type] = [];
					}
					if (!abis[image.type].includes(image.abi)) {
						abis[image.type].push(image.abi);
					}
					for (const skin of image.skins) {
						if (!skins.includes(skin)) {
							skins.push(skin);
						}
					}
				}
			}

			const androidJarFile = join(dir, 'android.jar');

			platforms.push({
				abis:        abis,
				androidJar:  isFile(androidJarFile) ? androidJarFile : null,
				apiLevel,
				codename:    sourceProps['AndroidVersion.CodeName'] || null,
				defaultSkin,
				minToolsRev: sourceProps['Platform.MinToolsRev'] ? Number.parseInt(sourceProps['Platform.MinToolsRev']) : null,
				name:        `Android ${sourceProps['Platform.Version']}${sourceProps['AndroidVersion.CodeName'] ? ' (Preview)' : ''}`,
				path:        dir,
				revision:    sourceProps['Layoutlib.Revision'] ? Number.parseInt(sourceProps['Layoutlib.Revision']) : null,
				sdk,
				skins,
				version:     sourceProps['Platform.Version']
			});
		}

		return platforms.sort(sortPackages);
	}

	static async detectAddons(path: string, platforms: Platform[]): Promise<Addon[]> {
		const addons: Addon[] = [];
		const addonsDir = join(path, 'add-ons');
		if (!isDir(addonsDir)) {
			return addons;
		}

		for (const name of await readdir(addonsDir)) {
			const dir = join(addonsDir, name);
			const props = await readPropertiesFile(join(dir, 'source.properties')) || await readPropertiesFile(join(dir, 'manifest.ini'));
			if (!props) {
				continue;
			}

			const apiLevel = Number.parseInt(props['AndroidVersion.ApiLevel'] || props.api);
			const vendorDisplay = props['Addon.VendorDisplay'] || props.vendor;
			const nameDisplay = props['Addon.NameDisplay'] || props.name;
			if (!apiLevel || isNaN(apiLevel) || !vendorDisplay || !nameDisplay) {
				continue;
			}

			let basedOn: Platform | null = null;
			for (const platform of platforms) {
				if (platform.codename === null && platform.apiLevel === apiLevel) {
					basedOn = platform;
					break;
				}
			}

			addons.push({
				abis:        basedOn?.abis || null,
				androidJar:  basedOn?.androidJar || null,
				apiLevel:    apiLevel,
				basedOn:     basedOn ? { version: basedOn.version, apiLevel: basedOn.apiLevel } : null,
				codename:    props['AndroidVersion.CodeName'] || props.codename || null,
				defaultSkin: basedOn && basedOn.defaultSkin || null,
				description: props['Pkg.Desc'] || props.description || null,
				minToolsRev: basedOn && basedOn.minToolsRev || null,
				name:        nameDisplay,
				path:        dir,
				revision:    Number.parseInt(props['Pkg.Revision'] || props.revision) || null,
				sdk:         `${vendorDisplay}:${nameDisplay}:${apiLevel}`,
				skins:       basedOn && basedOn.skins || null,
				vendor: 	 vendorDisplay,
				version:	 basedOn && basedOn.version || null
			});
		}

		return addons.sort(sortPackages);
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

type SortablePackage = {
	apiLevel: number;
	codename: string | null;
}

function sortPackages<T extends SortablePackage>(a: T, b: T) {
	if (a.codename === null) {
		if (b.codename !== null && a.apiLevel === b.apiLevel) {
			// sort GA releases before preview releases
			return -1;
		}
	} else if (a.apiLevel === b.apiLevel) {
		return b.codename === null ? 1 : a.codename.localeCompare(b.codename);
	}

	return a.apiLevel - b.apiLevel;
}
