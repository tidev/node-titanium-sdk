import { config } from './config.js';
import { expand } from './util/expand.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isDir } from './util/is-dir.js';
import { isFile } from './util/is-file.js';
import { realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import snooplogg from 'snooplogg';

const { error, log } = snooplogg('jdk');

const execFileAsync = promisify(execFile);

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

type JDKExecutables = {
	java: string;
	javac: string;
	keytool: string;
	jarsigner: string;
};

export class JDK {
	build: number | null;
	executables: JDKExecutables;
	path: string;
	version: string;

	private constructor({
		build,
		executables,
		path,
		version,
	}: {
		build: number | null;
		executables: JDKExecutables;
		path: string;
		version: string;
	}) {
		this.build = build;
		this.executables = executables;
		this.path = path;
		this.version = version;
	}

	static async load(path: string): Promise<JDK> {
		log(`Loading: ${path}`);
		if (typeof path !== 'string') {
			throw new TypeError('Expected JDK path to be a valid string');
		}
		if (!isDir(path)) {
			throw new Error(`JDK path does not exist: ${path}`);
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
			throw new Error(`Directory missing JVM library: ${path}`);
		}

		const executables: JDKExecutables = {
			java: '',
			javac: '',
			keytool: '',
			jarsigner: '',
		};

		const results = await Promise.all(
			Object.keys(executables).map(async cmd => {
				const p = join(path, 'bin', `${cmd}${exe}`);
				if (isFile(p)) {
					executables[cmd] = await realpath(p);
					return true;
				}
				return false;
			}
		));

		if (!results.every(result => result)) {
			throw new Error(`Directory missing required program: ${path}`);
		}

		let output = '';
		try {
			const { stderr, stdout } = await execFileAsync(executables.javac, ['-version']);
			output = stdout || stderr;
		} catch (error: any) {
			// javac -version may exit with non-zero code but still provide output
			output = error.stderr || '';
		}

		const result = output.trim().match(/javac (.+?)(?:_(.+))?$/);
		const version = result?.[1] ?? '';
		if (!version) {
			throw new Error(`Failed to determine JDK version: ${path}`);
		}
		const build = result?.[2] ? Number.parseInt(result[2]) : null;

		log(`Found JDK: ${path} (version: ${version}, build: ${build})`);

		return new JDK({
			build,
			executables,
			path,
			version,
		});
	}
}

interface JDKs {
	home: string | null;
	jdks: JDK[];
}

let jdkCache: JDKs | null = null;

export async function detect(options: {
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
		// TODO: check the Windows Registry
		// config.jdk.windows.registryKeys
	}

	const results = await Promise.allSettled(pending);
	const jdks: JDK[] = [];
	const errors: Error[] = [];
	for (const result of results) {
		if (result.status === 'fulfilled' && result.value) {
			jdks.push(result.value);
		} else if (result.status === 'rejected') {
			errors.push(result.reason.message);
		}
	}

	if (errors.length > 0) {
		error(errors.join('\n'));
	}

	jdkCache = {
		home,
		jdks,
	};
	return jdkCache;
}

