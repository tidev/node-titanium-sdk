import { config } from '../config.js';
import { expand } from '../util/expand.js';
import { createHash } from 'node:crypto';
import { tailgate } from '../util/tailgate.js';
import snooplogg from 'snooplogg';
import { isDir } from '../util/is-dir.js';

const { error, log } = snooplogg('android:sdk');

export class AndroidSDK {
	constructor() {
		//
	}

	static async load(path: string): Promise<AndroidSDK> {
		log(`Loading: ${path}`);
		if (typeof path !== 'string' || !path) {
			throw new TypeError('Expected Android SDK path to be a valid string');
		}
		if (!isDir(path)) {
			throw new Error('Android SDK path does not exist: ${path}');
		}

		return new AndroidSDK();
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
