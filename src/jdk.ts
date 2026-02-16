import { config } from './config.js';
import type { ErrorWithCode } from './types.js';
import { expand } from './util/expand.js';
import { isDir } from './util/is-dir.js';
import { isFile } from './util/is-file.js';
import { Issue } from './util/issue.js';
import { tailgate } from './util/tailgate.js';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import snooplogg from 'snooplogg';
import which from 'which';

const { log, warn } = snooplogg('jdk');

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
	darwin: ['jre/lib/server/libjvm.dylib', '../Libraries/libjvm.dylib', 'lib/server/libjvm.dylib'],
	win32: ['jre/bin/server/jvm.dll', 'jre/bin/client/jvm.dll', 'bin/server/jvm.dll'],
};

const exe = process.platform === 'win32' ? '.exe' : '';

interface JDKExecutables {
	java: string;
	javac: string;
	keytool: string;
	jarsigner: string;
}

interface JDKOptions extends JDKExecutables {
	path: string;
	version: string;
}

/**
 * Detects and organizes JDK information.
 */
export class JDK {
	path!: string;
	version!: string;
	java!: string;
	javac!: string;
	keytool!: string;
	jarsigner!: string;

	private constructor(options: JDKOptions) {
		Object.assign(this, options);
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

		const executables: JDKExecutables = {
			java: '',
			javac: '',
			keytool: '',
			jarsigner: '',
		};

		await Promise.all(
			Object.keys(executables).map(async (cmd) => {
				const p = join(path, 'bin', `${cmd}${exe}`);
				if (isFile(p)) {
					executables[cmd] = await realpath(p);
				} else {
					const err = new Error(`Directory missing required program: ${path}`) as ErrorWithCode;
					err.code = 'JDK_MISSING_REQUIRED_PROGRAM';
					throw err;
				}
			})
		);

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
		log(`Found JDK: ${path} (version: ${version})`);

		return new JDK({
			path,
			version,
			...executables,
		});
	}
}

interface JDKs {
	home: string | null;
	jdks: JDK[];
	issues: Issue[];
}

export async function detectJDKs(
	options: {
		javaHome?: string;
		searchPaths?: string[];
	} = {}
): Promise<JDKs> {
	const { home, searchPaths } = await getSearchPaths(options);

	return tailgate('jdk:detect', async () => {
		const jdks: JDK[] = [];
		const issues: Issue[] = [];
		const queue: { path: string; depth: number }[] = searchPaths.map((path) => ({
			path,
			depth: 0,
		}));
		const visited = new Set<string>();

		while (queue.length > 0) {
			const { path, depth } = queue.shift()!;
			if (visited.has(path)) {
				continue;
			}
			visited.add(path);
			try {
				jdks.push(await JDK.load(path));
			} catch (err) {
				if (err instanceof Error && 'code' in err && err.code === 'JDK_MISSING_REQUIRED_PROGRAM') {
					// Not a JDK, check subdirectories
					if (depth === 0) {
						for (const name of await readdir(path)) {
							const dir = join(path, name);
							if (isDir(dir)) {
								queue.push({ path: dir, depth: 1 });
							}
						}
					} else {
						warn(err);
					}
				} else if (err instanceof Issue) {
					warn(err.message);
					issues.push(err);
				} else {
					// ignore all other errors
					warn(err);
				}
			}
		}

		if (process.platform === 'win32') {
			for (const jdk of jdks) {
				if (jdk.path.includes('&')) {
					issues.push(
						new Issue(`JDK path contains ampersand: ${jdk.path}`, {
							id: 'JDK_PATH_CONTAINS_AMPERSAND',
							type: 'warning',
							details: 'The JDK path contains an ampersand (&) and may cause issues.',
						})
					);
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

		return {
			home,
			jdks,
			issues,
		};
	});
}

async function getSearchPaths(options: { javaHome?: string; searchPaths?: string[] }) {
	const searchPaths = new Set<string>();
	if (Array.isArray(options?.searchPaths)) {
		for (const path of options.searchPaths) {
			searchPaths.add(expand(path));
		}
	}

	const configPaths = config.jdk.searchPaths[process.platform];
	if (Array.isArray(configPaths)) {
		for (const path of configPaths) {
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
