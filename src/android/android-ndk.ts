import { config } from '../config.js';
import { basename, join } from 'node:path';
import { isDir } from '../util/is-dir.js';
import { isFile } from '../util/is-file.js';
import { expand } from '../util/expand.js';
import { tailgate } from '../util/tailgate.js';
import { createHash } from 'node:crypto';
import snooplogg from 'snooplogg';
import { Issue } from '../util/issue.js';
import { readdir, readFile } from 'node:fs/promises';
import { readPropertiesFile } from './util/read-properties-file.js';
import which from 'which';

const { error, log } = snooplogg('android:ndk');

const cmd = process.platform === 'win32' ? '.cmd' : '';

/**
 * A cached regex for matching the NDK architecture.
 * @type {RegExp}
 */
const archRegExp = /\w-x86_64[/\\]/m;

/**
 * A cached regex for matching the NDK release version.
 * @type {RegExp}
 */
const releaseRegExp = /^(r(\d+)([A-Za-z])?)(?:\s+\(([^)]+)\))?$/;

/**
 * A cached regex for matching the NDK version.
 * @type {RegExp}
 */
const versionRegExp = /^(\d+)(?:\.(\d+))?/;

/**
 * Detects and organizes Android NDK information.
 */
export class AndroidNDK {
	arch: string;
	executables: Record<string, string>;
	name: string;
	path: string;
	version: string | null;

	private constructor({ path, name, version, arch, executables }: { path: string, name: string, version: string | null, arch: string, executables: Record<string, string> }) {
		this.arch = arch;
		this.executables = executables;
		this.name = name;
		this.path = path;
		this.version = version;
	}

	static async load(path: string): Promise<AndroidNDK> {
		log(`Loading: ${path}`);
		if (typeof path !== 'string' || !path) {
			throw new TypeError('Expected Android NDK path to be a valid string');
		}
		if (!isDir(path)) {
			throw new Error('Android NDK path does not exist: ${path}');
		}

		for (const name of [ 'build', 'platforms' ]) {
			if (!isDir(join(path, name))) {
				throw new Error(`Directory does not contain the "${name}" directory`);
			}
		}

		let ndkWhich = join(path, `ndk-which${cmd}`);

		if (process.platform === 'win32' && !isFile(ndkWhich)) {
			// For some reason, some releases of the Android NDK have a `ndk-which`
			// executable without a `.cmd` extension
			ndkWhich = join(path, 'ndk-which');
		}

		let name = basename(path);
		let version: string | null = null;
		let arch = '32-bit';
		let executables = {
			'ndk-build': join(path, `ndk-build${cmd}`),
			'ndk-which': ndkWhich
		};

		for (const name of Object.keys(executables)) {
			if (!isFile(executables[name])) {
				throw new Error(`Directory does not contain the "${name}" executable`);
			}
		}

		// get the archtecture
		if (archRegExp.test(await readFile(executables['ndk-which'], 'utf8'))) {
			arch = '64-bit';
		}

		// get the version
		const sourceProps = await readPropertiesFile(join(path, 'source.properties'));
		if (sourceProps) {
			version = sourceProps['Pkg.Revision'];
			if (version) {
				const m = version.match(versionRegExp);
				if (m) {
					if (m[2] === undefined) {
						version = `${m[1]}.0`;
					} else if (Number.parseInt(m[2]) !== 0) {
						name = `r${m[1]}${String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(m[2]))}`;
					}
				}
			}
		}

		if (!version) {
			// no version, try to find it in the release.txt file
			for (const filename of await readdir(path)) {
				if (filename.toLowerCase() === 'release.txt') {
					const release = (await readFile(join(path, filename), 'utf8')).split(/\r?\n/).shift()?.trim();
					// release comes back in the format "r10e (64-bit)", so we
					// need to extract a meaningful version number from that
					const m = release?.match(releaseRegExp);
					if (m) {
						name = m[1];
						const minor = (m[3] ? m[3].toLowerCase() : 'a').charCodeAt(0) - 'a'.charCodeAt(0);
						version = `${m[2]}.${minor}`;
						if (m[4] && m[4].toLowerCase() === '64-bit') {
							arch = '64-bit';
						}
					}
					break;
				}
			}
		}

		log(`Found Android NDK: ${path} (version: ${version}, arch: ${arch})`);
		return new AndroidNDK({
			arch,
			executables,
			name,
			path,
			version,
		});
	}
}

interface NDKs {
	ndks: AndroidNDK[];
	issues: Issue[];
}

let ndkCache: NDKs | null = null;
let ndkSearchPathsHash: string | null = null;

/**
 * Detects installed letAndroid NDKs, then caches and returns the results.
 *
 * @param {Boolean} [force=false] - When `true`, bypasses cache and forces redetection.
 * @returns {Promise<Array.<NDK>>}
 */
export async function detect(options: {
	bypassCache?: boolean;
	searchPaths?: string[];
} = {}): Promise<NDKs> {
	const searchPaths = await getSearchPaths(options);
	const searchPathsHash = createHash('sha256')
		.update(searchPaths.toSorted().join()).digest('hex');

	if (ndkCache !== null && !options.bypassCache && ndkSearchPathsHash === searchPathsHash) {
		return ndkCache;
	}

	return tailgate('android:ndk:detect', async () => {
		const results = await Promise.allSettled(searchPaths.map(async path => {
			try {
				return await AndroidNDK.load(path);
			} catch (e) {
				// Not an NDK, check subdirectories
				if (isDir(path)) {
					for (const name of await readdir(path)) {
						try {
							return await AndroidNDK.load(join(path, name));
						} catch {
							// Not an NDK, check subdirectories
						}
					}
				}
				throw e;
			}
		}));
		const ndks: AndroidNDK[] = [];
		const issues: Issue[] = [];

		for (const result of results) {
			if (result.status === 'fulfilled' && result.value) {
				ndks.push(result.value);
			} else if (result.status === 'rejected') {
				error(result.reason.message);
			}
		}

		if (!ndks.length) {
			issues.push(new Issue('No Android NDKs found', {
				id: 'ANDROID_NDK_NOT_FOUND',
				type: 'warning',
				details: 'No Android NDKs found. Please install the Android NDK and try again.',
			}));
		}

		ndkCache = {
			ndks,
			issues,
		};
		ndkSearchPathsHash = searchPathsHash;

		return ndkCache;
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

	const ndkBuildPath = await which(`ndk-build${cmd}`, { nothrow: true });
	if (ndkBuildPath) {
		searchPaths.add(expand(ndkBuildPath, '..', '..'));
	}

	return Array.from(searchPaths);
}
