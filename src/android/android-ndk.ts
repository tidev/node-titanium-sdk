import { config } from '../config.js';
import type { ErrorWithCode } from '../types.js';
import { expand } from '../util/expand.js';
import { isDir } from '../util/is-dir.js';
import { isFile } from '../util/is-file.js';
import { Issue } from '../util/issue.js';
import { tailgate } from '../util/tailgate.js';
import { readPropertiesFile } from './util/read-properties-file.js';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import snooplogg from 'snooplogg';
import which from 'which';

const { log, warn } = snooplogg('android:ndk');

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

type AndroidNDKOptions = {
	arch: string;
	executables: Record<string, string>;
	name: string;
	path: string;
	version: string | null;
};

/**
 * Detects and organizes Android NDK information.
 */
export class AndroidNDK {
	arch!: string;
	executables!: Record<string, string>;
	name!: string;
	path!: string;
	version!: string | null;

	private constructor(options: AndroidNDKOptions) {
		Object.assign(this, options);
	}

	static async load(path: string): Promise<AndroidNDK> {
		log(`Loading: ${path}`);
		if (typeof path !== 'string' || !path) {
			throw new TypeError('Expected Android NDK path to be a valid string');
		}
		if (!isDir(path)) {
			throw new Error(`Android NDK path does not exist: ${path}`);
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
			'ndk-which': ndkWhich,
		};

		for (const name of Object.keys(executables)) {
			if (!isFile(executables[name])) {
				const err = new Error(
					`Directory does not contain the "${name}" executable`
				) as ErrorWithCode;
				err.code = 'ANDROID_NDK_MISSING_EXECUTABLE';
				throw err;
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
					const release = (await readFile(join(path, filename), 'utf8'))
						.split(/\r?\n/)
						.shift()
						?.trim();
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

/**
 * Detects installed Android NDKs.
 *
 * @param {Object} options - The options for the detection.
 * @param {string[]} [options.searchPaths] - The paths to search for Android NDKs.
 * @returns {Promise<Array.<NDK>>}
 */
export async function detectAndroidNDKs(
	options: {
		searchPaths?: string[];
	} = {}
): Promise<NDKs> {
	const searchPaths = await getSearchPaths(options);

	return tailgate('android:ndk:detect', async () => {
		const ndks: AndroidNDK[] = [];
		const ndkPaths = new Set<string>();
		const issues: Issue[] = [];

		async function processPath(
			path: string,
			depth: number
		): Promise<{ ndk: AndroidNDK | null; subdirs: string[] }> {
			try {
				const ndk = await AndroidNDK.load(path);
				return { ndk, subdirs: [] };
			} catch (err) {
				if (
					err instanceof Error &&
					'code' in err &&
					(err.code === 'ANDROID_NDK_MISSING_EXECUTABLE' ||
						err.code === 'ANDROID_NDK_MISSING_DIRECTORY')
				) {
					if (depth === 0) {
						const subdirs: string[] = [];
						for (const name of await readdir(path)) {
							const dir = join(path, name);
							if (isDir(dir)) {
								subdirs.push(dir);
							}
						}
						return { ndk: null, subdirs };
					}
					warn(err);
					return { ndk: null, subdirs: [] };
				}
				if (err instanceof Issue) {
					warn(err.message);
					issues.push(err);
					return { ndk: null, subdirs: [] };
				}
				warn(err);
				return { ndk: null, subdirs: [] };
			}
		}

		const level0Results = await Promise.all(searchPaths.map((path) => processPath(path, 0)));
		const subdirs: string[] = [];
		for (const { ndk, subdirs: s } of level0Results) {
			if (ndk && !ndkPaths.has(ndk.path)) {
				ndkPaths.add(ndk.path);
				ndks.push(ndk);
			}
			subdirs.push(...s);
		}

		const level1Results = await Promise.all(subdirs.map((path) => processPath(path, 1)));
		for (const { ndk } of level1Results) {
			if (ndk && !ndkPaths.has(ndk.path)) {
				ndkPaths.add(ndk.path);
				ndks.push(ndk);
			}
		}

		if (!ndks.length) {
			issues.push(
				new Issue('No Android NDKs found', {
					id: 'ANDROID_NDK_NOT_FOUND',
					type: 'warning',
					details: 'No Android NDKs found. Please install the Android NDK and try again.',
				})
			);
		}

		return {
			ndks,
			issues,
		};
	});
}

async function getSearchPaths(options: { searchPaths?: string[] }) {
	const searchPaths = new Set<string>();
	if (Array.isArray(options?.searchPaths)) {
		for (const path of options.searchPaths) {
			searchPaths.add(expand(path));
		}
	}

	const configPaths = config.android.ndk.searchPaths[process.platform];
	if (Array.isArray(configPaths)) {
		for (const path of configPaths) {
			searchPaths.add(expand(path));
		}
	}

	const ndkBuildPath = await which(`ndk-build${cmd}`, { nothrow: true });
	if (ndkBuildPath) {
		searchPaths.add(expand(ndkBuildPath, '..', '..'));
	}

	return Array.from(searchPaths);
}
