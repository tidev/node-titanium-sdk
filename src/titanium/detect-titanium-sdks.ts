import { config } from '../config.js';
import { expand, isDir, tailgate } from '../util/index.js';
import { Issue } from '../util/issue.js';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const os = process.platform === 'darwin' ? 'osx' : process.platform;

type TitaniumSDKOptions = {
	manifest: Record<string, any>;
	name: string;
	path: string;
	platforms: Record<string, { path: string }>;
	type: string;
	version: string;
};

type TitaniumSDKManifest = {
	name: string;
	version: string;
	moduleAPIVersion: Record<string, string>;
	timestamp: string;
	githash: string;
	platforms: string[];
};

class TitaniumSDK {
	manifest!: TitaniumSDKManifest;
	name!: string;
	path!: string;
	platforms!: Record<string, { path: string }>;
	type!: string;
	version!: string;

	private constructor(options: TitaniumSDKOptions) {
		Object.assign(this, options);

		if (typeof this.name !== 'string' || !this.name) {
			throw new TypeError('Expected Titanium SDK name to be a valid string');
		}
	}

	static async load(path: string): Promise<TitaniumSDK> {
		const manifestFile = await readFile(join(path, 'manifest.json'), 'utf8');
		const manifest = JSON.parse(manifestFile);

		return new TitaniumSDK({
			name: manifest.name,
			manifest,
			path,
			platforms: Array.isArray(manifest.platforms)
				? manifest.platforms.reduce((platforms, name) => {
						platforms[name] = {
							path: join(path, name),
						};
						return platforms;
					}, {})
				: {},
			type: getSDKType(manifest.name),
			version: manifest.version,
		});
	}
}

type TitaniumSDKMap = Record<string, TitaniumSDK>;

interface TiSDKs {
	installPath: string;
	latest: string | null;
	sdkPaths: string[];
	sdks: TitaniumSDKMap;
	issues: Issue[];
}

/**
 * Detects installed Titanium SDKs.
 *
 * @param options - The options for the detection.
 * @param options.searchPaths - The paths to search for Titanium SDKs.
 * @returns The detected Titanium SDKs.
 */
export async function detectTitaniumSDKs(
	options: {
		searchPaths?: string[];
	} = {}
): Promise<TiSDKs> {
	const searchPaths = await getSearchPaths(options);

	return tailgate('titanium:tisdk:detect', async () => {
		const sdks: TitaniumSDKMap = {};

		await Promise.all(
			searchPaths.map(async (path) => {
				// path could be an actual SDK or it could be a Titanium install
				// directory with the mobilesdk/<os> subdir
				try {
					const sdk = await TitaniumSDK.load(path);
					sdks[sdk.name] = sdk;
				} catch {
					// Not an SDK, check subdirectories
					if (basename(path) !== os && basename(dirname(path)) !== 'mobilesdk') {
						path = join(path, 'mobilesdk', os);
					}
					if (isDir(path)) {
						for (const dir of await readdir(path)) {
							try {
								const sdk = await TitaniumSDK.load(join(path, dir));
								sdks[sdk.name] = sdk;
							} catch {
								// Not an SDK
							}
						}
					}
				}
			})
		);

		const issues: Issue[] = [];

		if (Object.keys(sdks).length === 0) {
			issues.push(
				new Issue('No Titanium SDKs found', {
					id: 'TITANIUM_SDK_NOT_FOUND',
					type: 'warning',
					details: 'No Titanium SDKs found. Please install the Titanium SDK and try again.',
				})
			);
		}

		return {
			installPath: config.titanium.sdk.installPath[process.platform],
			latest: Object.keys(sdks).find((s) => /.GA$/.test(s)) || null,
			sdkPaths: searchPaths,
			sdks,
			issues,
		};
	});
}

function getSearchPaths(options: { searchPaths?: string[] }) {
	const searchPaths = new Set<string>();

	if (Array.isArray(options?.searchPaths)) {
		for (const path of options.searchPaths) {
			if (typeof path === 'string') {
				searchPaths.add(expand(path));
			}
		}
	}

	if (config.titanium.sdk.installPath[process.platform]) {
		searchPaths.add(expand(config.titanium.sdk.installPath[process.platform]));
	}

	const configPaths = config.titanium.sdk.searchPaths[process.platform];
	if (Array.isArray(configPaths)) {
		for (const path of configPaths) {
			searchPaths.add(expand(path));
		}
	}

	return Array.from(searchPaths);
}

function getSDKType(name) {
	if (/\.ga$/i.test(name)) {
		return 'ga';
	}
	if (/\.rc$/i.test(name)) {
		return 'rc';
	}
	if (/\.beta$/i.test(name)) {
		return 'beta';
	}
	if (/\.v\d+$/i.test(name)) {
		return 'nightly';
	}
	return 'local';
}
