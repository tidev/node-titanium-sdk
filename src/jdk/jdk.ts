import { ErrorWithCode } from '../util/error.js';
import { isDir } from '../util/is-dir.js';
import { isFile } from '../util/is-file.js';
import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { snooplogg } from 'snooplogg';

const { log } = snooplogg('jdk');

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
					throw new ErrorWithCode(
						`Directory missing required program: ${p}`,
						'JDK_MISSING_REQUIRED_PROGRAM'
					);
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
