import { config } from './config.js';
import { expand } from './util/expand.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isDir } from './util/is-dir.js';
import { isFile } from './util/is-file.js';
import { realpath } from 'node:fs/promises';

/**
 * Common search paths for the JVM library. This is used only for validating if
 * a directory is a JDK.
 * @type {Object}
 */
export const libjvmLocations: Record<string, string[]> = {
	linux: [
		'lib/amd64/client/libjvm.so',
		'lib/amd64/server/libjvm.so',
		'lib/i386/client/libjvm.so',
		'lib/i386/server/libjvm.so',
		'jre/lib/amd64/client/libjvm.so',
		'jre/lib/amd64/server/libjvm.so',
		'jre/lib/i386/client/libjvm.so',
		'jre/lib/i386/server/libjvm.so',
		'lib/server/libjvm.so'
	],
	darwin: [
		'jre/lib/server/libjvm.dylib',
		'../Libraries/libjvm.dylib',
		'lib/server/libjvm.dylib'
	],
	win32: [
		'jre/bin/server/jvm.dll',
		'jre/bin/client/jvm.dll',
		'bin/server/jvm.dll'
	]
};

const exe = process.platform === 'win32' ? '.exe' : '';

export class JDK {
	architecture: string | null = null;
	build: string | null = null;
	executables: Record<string, string> = {};
	path: string;
	version: string | null = null;

	constructor(path: string) {
		this.path = path;
	}

	static async load(path: string): Promise<JDK | null> {
		if (!path || typeof path !== 'string' || !isDir(path)) {
			return null;
		}

		// on macOS, the JDK lives in Contents/Home
		if (process.platform === 'darwin') {
			const macosPath = join(path, 'Contents', 'Home');
			if (isDir(macosPath)) {
				path = macosPath;
			}
		}

		const libjvms = libjvmLocations[process.platform];
		if (!libjvms || !libjvms.some(p => isFile(join(path, p)))) {
			throw new Error('Directory missing JVM library');
		}

		const executables: Record<string, string> = {};

		const commands = [ 'java', 'javac', 'keytool', 'jarsigner' ];
		const results = await Promise.all(commands.map(async cmd => {
			const p = join(path, 'bin', `${cmd}${exe}`);
			if (isFile(p)) {
				executables[cmd] = await realpath(p);
				return true;
			}
			return false;
		}));

		if (!results.every(result => result)) {
			throw new Error('Directory missing required program');
		}

		return new JDK(path);
	}
}

interface JDKs {
	home: string | null;
	jdks: JDK[];
}

let jdkCache: JDKs | null = null;

export async function findJDKs(options: {
	bypassCache?: boolean,
} = {}): Promise<JDKs> {
	if (jdkCache !== null && !options.bypassCache) {
		return jdkCache;
	}

	const searchPaths = new Set<string>();
	const pending: Promise<JDK | null>[] = [];

	let home = config.jdk?.javaHome || process.env.JAVA_HOME || null;
	if (home && typeof home === 'string') {
		home = expand(home);
		if (existsSync(home)) {
			searchPaths.add(home);
			pending.push(JDK.load(home));
		} else {
			home = null;
		}
	}

	if (config.jdk?.searchPaths) {
		const paths = config.jdk.searchPaths[process.platform] || config.jdk.searchPaths;
		if (Array.isArray(paths)) {
			for (let path of paths) {
				path = expand(path);
				if (!searchPaths.has(path)) {
					searchPaths.add(path);
					pending.push(JDK.load(path));
				}
			}
		}
	}

	if (process.platform === 'win32') {
		// check the Windows Registry
	}

	await Promise.all(pending);

	const result: JDKs = {
		home,
		jdks: [],
	};

	jdkCache = result;
	return result;
}

