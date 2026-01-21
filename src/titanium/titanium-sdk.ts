import { createHash } from 'node:crypto';
import { config } from '../config';
import { expand } from '../util/expand';
import { tailgate } from '../util/tailgate';
import { Issue } from '../util/issue';

class TitaniumSDK {
	path: string;

	private constructor({ path }: { path: string }) {
		this.path = path;
	}

	static async load(path: string): Promise<TitaniumSDK> {
		return new TitaniumSDK({ path });
	}
}

interface TiSDKs {
	sdks: TitaniumSDK[];
	issues: Issue[];
}

let tisdkCache: TiSDKs | null = null;
let tisdkSearchPathsHash: string | null = null;

export async function detectInstalledSDKs(options: {
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
		const results = await Promise.allSettled(searchPaths.map(async path => {
			try {
				return await TitaniumSDK.load(path);
			} catch {
				// Not a Titanium SDK
			}
		}));
		const sdks: TitaniumSDK[] = [];
		const issues: Issue[] = [];

		for (const result of results) {
			if (result.status === 'fulfilled' && result.value) {
				sdks.push(result.value);
			}
		}

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
	const paths: string[] = [];
	if (Array.isArray(options.searchPaths)) {
		paths.push(...options.searchPaths);
	}

	const configPaths = config.titanium.sdk.searchPaths[process.platform];
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
