import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { expand } from '../util/expand.js';
import { tailgate } from '../util/tailgate.js';
import { Issue } from '../util/issue.js';
import { isDir } from '../util/is-dir.js';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { request } from '../util/request.js';

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
						path: join(path, name)
					};
					return platforms;
				}, {})
				: {},
			type: getSDKType(manifest.name),
			version: manifest.version
		});
	}
}

interface TiSDKs {
	sdks: TitaniumSDK[];
	issues: Issue[];
}

let tisdkCache: TiSDKs | null = null;
let tisdkSearchPathsHash: string | null = null;

export async function detectTitaniumSDKs(options: {
	bypassCache?: boolean;
	searchPaths?: string[];
} = {}): Promise<TiSDKs> {
	const searchPaths = await getSearchPaths(options);
	const searchPathsHash = createHash('sha256')
		.update(searchPaths.toSorted().join()).digest('hex');

	if (tisdkCache !== null && !options.bypassCache && tisdkSearchPathsHash === searchPathsHash) {
		return tisdkCache;
	}

	return tailgate('titanium:tisdk:detect', async () => {
		const sdks: TitaniumSDK[] = [];

		await Promise.all(searchPaths.map(async path => {
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
		}));

		const issues: Issue[] = [];

		if (!sdks.length) {
			issues.push(new Issue('No Titanium SDKs found', {
				id: 'TITANIUM_SDK_NOT_FOUND',
				type: 'warning',
				details: 'No Titanium SDKs found. Please install the Titanium SDK and try again.',
			}));
		}

		tisdkCache = {
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

const sortTypes = ['local', 'nightly', 'beta', 'rc', 'ga'];

type TitaniumRelease = {
	name: string;
	version: string;
	date: string;
	assets: {
		os: string;
		url: string;
		size: number;
	}[];
	type: string;
};

/**
 * Retrieves the list of releases.
 * @param unstable - When `true`, returns beta and rc releases along with ga releases.
 * @returns {Promise<TitaniumRelease[]>}
 */
export async function getTitaniumReleases(unstable?: boolean): Promise<TitaniumRelease[]> {
	const releaseRE = /^(\d+)\.(\d+)\.(\d+)\.(\w+)$/;

	const fetches = [
		unstable && request(config.titanium.sdk.downloadURLs.releases.beta, {
			responseType: 'json'
		}).then(async res => ({
			type: 'beta',
			releases: (await res.body.json()) as TitaniumRelease[]
		})),

		unstable && request(config.titanium.sdk.downloadURLs.releases.rc, {
			responseType: 'json'
		}).then(async res => ({
			type: 'rc',
			releases: (await res.body.json()) as TitaniumRelease[]
		})),

		request(config.titanium.sdk.downloadURLs.releases.ga, {
			responseType: 'json'
		}).then(async res => ({
			type: 'ga',
			releases: (await res.body.json()) as TitaniumRelease[]
		}))
	];

	const results = await Promise.all(fetches);

	return results
		.flatMap(value => {
			return value ? value.releases.map(rel => {
				rel.type = value.type;
				return rel;
			}) : [];
		})
		.filter(r => r.assets.some(a => a.os === os))
		.sort((a, b) => {
			const aMatch = a.name.toLowerCase().match(releaseRE);
			const bMatch = b.name.toLowerCase().match(releaseRE);

			if (!aMatch || !bMatch) {
				return 0;
			}

			const [, amajor, aminor, apatch, atag] = aMatch;
			const [, bmajor, bminor, bpatch, btag] = bMatch;

			let n = parseInt(bmajor) - parseInt(amajor);
			if (n !== 0) {
				return n;
			}

			n = parseInt(bminor) - parseInt(aminor);
			if (n !== 0) {
				return n;
			}

			n = parseInt(bpatch) - parseInt(apatch);
			if (n !== 0) {
				return n;
			}

			return sortTypes.indexOf(btag) - sortTypes.indexOf(atag);
		});
}

/**
 * Retrieves the list of branches.
 * @returns {Promise<Branches>}
 */
export async function getTitaniumBranches(): Promise<string[]> {
	const res = await request(config.titanium.sdk.downloadURLs.branches, {
		responseType: 'json'
	});
	return Object
		.entries((await res.body.json()) as Record<string, number>)
		.filter(([, count]) => count)
		.map(([name]) => name);
}

type TitaniumBuild = {
	name: string;
	version: string;
	date: string;
	expires: string;
	url: string;
	assets: {
		os: string;
		url: string;
		size: number;
	}[];
}

/**
 * Retrieves the list of builds for a given branch.
 * @param {String} branch - The name of the branch
 * @param {String} os - The name of the current OS (osx, linux, win32)
 * @returns {Promise<BranchBuild[]>}
 */
export async function getTitaniumBranchBuilds(branch: string, os: string): Promise<TitaniumBuild[]> {
	const res = await request(config.titanium.sdk.downloadURLs.branchBuilds.replace('${branch}', branch), {
		responseType: 'json'
	});
	const now = Date.now();
	const results = (await res.body.json()) as TitaniumBuild[];
	return results.filter(b => {
		return (!b.expires || Date.parse(b.expires) > now) && b.assets.some(a => a.os === os);
	});
}
