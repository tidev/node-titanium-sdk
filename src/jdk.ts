import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import snooplogg from 'snooplogg';
import { config } from './config.js';
import { expand } from './util/expand.js';
import { isDir } from './util/is-dir.js';
import { isFile } from './util/is-file.js';
import { Issue } from './util/issue.js';
import { tailgate } from './util/tailgate.js';
import which from 'which';

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
		'lib/server/libjvm.so',
	],
	darwin: [
		'jre/lib/server/libjvm.dylib',
		'../Libraries/libjvm.dylib',
		'lib/server/libjvm.dylib',
	],
	win32: [
		'jre/bin/server/jvm.dll',
		'jre/bin/client/jvm.dll',
		'bin/server/jvm.dll',
	],
};

const exe = process.platform === 'win32' ? '.exe' : '';

type JDKExecutables = {
	java: string;
	javac: string;
	keytool: string;
	jarsigner: string;
};

/**
 * Detects and organizes JDK information.
 */
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
			})
		);

		if (!results.every(result => result)) {
			throw new Issue(`Directory missing required program: ${path}`, {
				id: 'JDK_MISSING_PROGRAMS',
				type: 'warning',
				details: `JDK (Java Development Kit) at ${path} missing required programs: ${
					Object.keys(executables).filter(cmd => !executables[cmd]).join(', ')
				}
${
					process.env.JAVA_HOME
						? 'Please verify your __JAVA_HOME__ environment variable is correctly set to the JDK install location.\n'
							+ `__JAVA_HOME__ is currently set to "${process.env.JAVA_HOME}".`
						: 'Please set the __JAVA_HOME__ environment variable to the JDK install location and not the JRE (Java Runtime Environment).'
				}
The __JAVA_HOME__ environment variable must point to the JDK and not the JRE (Java Runtime Environment).
You may want to reinstall the JDK by downloading it from __https://www.oracle.com/java/technologies/downloads/__
or __https://jdk.java.net/archive/__.`,
			});
		}

		let output = '';
		try {
			const { stderr, stdout } = await execFileAsync(executables.javac, ['-version']);
			output = stderr || stdout || '';
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
	issues: Issue[];
}

let jdkCache: JDKs | null = null;
let jdkSearchPathsHash: string | null = null;

export async function detect(options: {
	bypassCache?: boolean;
	javaHome?: string;
	searchPaths?: string[];
} = {}): Promise<JDKs> {
	const { home, searchPaths } = await getSearchPaths(options);
	const searchPathsHash = createHash('sha256')
		.update(searchPaths.toSorted().join()).digest('hex');

	if (jdkCache !== null && !options.bypassCache && jdkSearchPathsHash === searchPathsHash) {
		return jdkCache;
	}

	return tailgate('jdk:detect', async () => {
		const results = await Promise.allSettled(searchPaths.map(path => JDK.load(path)));
		const jdks: JDK[] = [];
		const issues: Issue[] = [];

		for (const result of results) {
			if (result.status === 'fulfilled' && result.value) {
				jdks.push(result.value);
			} else if (result.status === 'rejected') {
				error(result.reason.message);
				if (result.reason instanceof Issue) {
					issues.push(result.reason);
				}
			}
		}

		if (process.platform === 'win32') {
			for (const jdk of jdks) {
				if (jdk.path.includes('&')) {
					issues.push(new Issue(`JDK path contains ampersand: ${jdk.path}`, {
						id: 'JDK_PATH_CONTAINS_AMPERSAND',
						type: 'warning',
						details: 'The JDK path contains an ampersand (&) and may cause issues.',
					}));
				}
			}
		}

		if (!jdks.length) {
			issues.push(
				new Issue('No JDKs found', {
					id: 'JDK_NOT_FOUND',
					type: 'error',
					details: `JDK (Java Development Kit) not installed.
If you already have installed the JDK, verify your __JAVA_HOME__ environment variable is correctly set.
The JDK is required for Titanium and must be manually downloaded and installed from __https://www.oracle.com/java/technologies/downloads/__
or  __https://jdk.java.net/arpathschive/__.`,
				})
			);
		}

		jdkCache = {
			home,
			jdks,
			issues,
		};
		jdkSearchPathsHash = searchPathsHash;

		return jdkCache;
	});
}

async function getSearchPaths(options: { javaHome?: string; searchPaths?: string[] }) {
	const paths: string[] = [];
	if (Array.isArray(options.searchPaths)) {
		paths.push(...options.searchPaths);
	}
	const configPaths = config.jdk.searchPaths[process.platform];
	if (Array.isArray(configPaths)) {
		paths.push(...configPaths);
	}

	const searchPaths = new Set<string>();
	if (paths) {
		for (const path of paths) {
			searchPaths.add(expand(path));
		}
	}

	let home = options.javaHome ?? config.jdk.javaHome ?? process.env.JAVA_HOME ?? null;
	if (home && typeof home === 'string') {
		home = expand(home);
		if (existsSync(home)) {
			searchPaths.add(home);
		} else {
			home = null;
		}
	}

	if (process.platform === 'win32') {
		// TODO: check the Windows Registry
		// config.jdk.windows.registryKeys
	}

	const javacPath = await which(`javac${exe}`, { nothrow: true });
	if (javacPath) {
		searchPaths.add(expand(javacPath, '..'));
	}

	return {
		home,
		searchPaths: Array.from(searchPaths),
	};
}
