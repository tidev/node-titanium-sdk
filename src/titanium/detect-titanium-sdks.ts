import { config } from '../config.js';
import { expand } from '../util/expand.js';
import { isDir } from '../util/is-dir.js';
import { Issue } from '../util/issue.js';
import { tailgate } from '../util/tailgate.js';
import { createHash } from 'node:crypto';
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

interface TiSDKs {
	installPath: string;
	latest: string | null;
	sdkPaths: string[];
	sdks: TitaniumSDK[];
	issues: Issue[];
}

let tisdkCache: TiSDKs | null = null;
let tisdkSearchPathsHash: string | null = null;

export async function detectTitaniumSDKs(
	options: {
		bypassCache?: boolean;
		searchPaths?: string[];
	} = {}
): Promise<TiSDKs> {
	const searchPaths = await getSearchPaths(options);
	const searchPathsHash = createHash('sha256').update(searchPaths.toSorted().join()).digest('hex');

	if (tisdkCache !== null && !options.bypassCache && tisdkSearchPathsHash === searchPathsHash) {
		return tisdkCache;
	}

	return tailgate('titanium:tisdk:detect', async () => {
		const sdks: TitaniumSDK[] = [];

		await Promise.all(
			searchPaths.map(async (path) => {
				// path could be an actual SDK or it could be a Titanium install
				// directory with the mobilesdk/<os> subdir
				try {
					sdks.push(await TitaniumSDK.load(path));
				} catch {
					// Not an SDK, check subdirectories
					if (basename(path) !== os && basename(dirname(path)) !== 'mobilesdk') {
						path = join(path, 'mobilesdk', os);
					}
					if (isDir(path)) {
						for (const dir of await readdir(path)) {
							try {
								sdks.push(await TitaniumSDK.load(join(path, dir)));
							} catch {
								// Not an SDK
							}
						}
					}
				}
			})
		);

		const issues: Issue[] = [];

		if (!sdks.length) {
			issues.push(
				new Issue('No Titanium SDKs found', {
					id: 'TITANIUM_SDK_NOT_FOUND',
					type: 'warning',
					details: 'No Titanium SDKs found. Please install the Titanium SDK and try again.',
				})
			);
		}

		tisdkCache = {
			installPath: config.titanium.sdk.installPath[process.platform],
			latest: sdks.find((s) => /.GA$/.test(s.name))?.name || sdks[0]?.name || null,
			sdkPaths: searchPaths,
			sdks,
			issues,
		};
		tisdkSearchPathsHash = searchPathsHash;

		return tisdkCache;
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

	searchPaths.add(expand(config.titanium.sdk.installPath[process.platform]));

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
