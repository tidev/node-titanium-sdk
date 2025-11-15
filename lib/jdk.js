import path from 'node:path';
import fs from 'node:fs';
import { which } from 'which';
import { spawnSync } from 'node:child_process';
import { expand } from './util/expand.js';

const exe = process.platform === 'win32' ? '.exe' : '';
let cache;

/**
 * Detects if Java and the JDK are installed.
 * @param {Object} [config] - The CLI configuration
 * @param {Object} [opts] - Detection options; currently only 'bypassCache'
 * @returns {Promise<Object>}
 */
export async function detect(config, opts) {
	if (typeof config === 'function') {
		// 1 arg (function)
		finished = config;
		config = {};
		opts = {};
	} else if (typeof opts === 'function') {
		// 2 args (object, function)
		finished = opts;
		opts = {};
	} else if (!opts) {
		opts = {};
	}

	if (cache && !opts.bypassCache) {
		return cache;
	}

	let javaHome = (config.get ? config.get('java.home', process.env.JAVA_HOME) : (config.java && config.java.home || process.env.JAVA_HOME)) || null;
	const jdkPaths = [];
	const requiredTools = [ 'java', 'javac', 'keytool', 'jarsigner' ];
	const executables = {};
	const results = {
		jdks: {},
		home: null,
		version: null,
		build: null,
		executables: executables,
		issues: []
	};

	// sanity check the java home
	if (javaHome) {
		javaHome = expand(javaHome);
		if (!fs.existsSync(javaHome)) {
			javaHome = null;
		} else if (isJDK(javaHome)) {
			jdkPaths.push(javaHome);
		}
	}
	results.home = javaHome;

	switch (process.platform) {
		case 'linux':
			await which('javac').then(p => {
				p = path.dirname(path.dirname(p));
				if (!jdkPaths.includes(p) && isJDK(p)) {
					jdkPaths.push(p);
				}
			}).catch(() => {});
			break;
		case 'darwin':
			const { stdout, status } = spawnSync('/usr/libexec/java_home');
			if (status === 0) {
				const p = stdout.trim();
				if (!jdkPaths.includes(p) && isJDK(p)) {
					jdkPaths.push(p);
				}
			}

			await which('javac').then(p => {
				p = path.dirname(path.dirname(p));
				if (!jdkPaths.includes(p) && isJDK(p)) {
					jdkPaths.push(p);
				}
			}).catch(() => {});

			const parentDirs = [ '/Library/Java/JavaVirtualMachines', '/System/Library/Java/JavaVirtualMachines' ];
			for (const parent of parentDirs) {
				if (fs.existsSync(parent)) {
					for (const name of fs.readdirSync(parent)) {
						const p = path.join(parent, name, 'Contents', 'Home');
						if (!jdkPaths.includes(p) && isJDK(p)) {
							jdkPaths.push(p);
						}
					}
				}
			}
			break;
		case 'win32':
			const dirs = [ '%SystemDrive%', '%ProgramFiles%', '%ProgramFiles(x86)%', '%ProgramW6432%', '~' ];
			for (let dir of dirs) {
				dir = expand(dir);
				if (fs.existsSync(dir)) {
					for (const name of fs.readdirSync(dir)) {
						const subdir = path.join(dir, name);
						if (isJDK(subdir) && !jdkPaths.includes(subdir)) {
							jdkPaths.push(subdir);
						}
					}
				}
			}
			break;
	}

	let jdks = await Promise.all(jdkPaths.map(home => {
		const jdkInfo = {
			home,
			version: null,
			build: null,
			executables: {}
		};
		const missingTools = [];

		for (const cmd of requiredTools) {
			const p = path.join(home, 'bin', cmd + exe);
			if (fs.existsSync(p)) {
				jdkInfo.executables[cmd] = fs.realpathSync(p);
			} else {
				missingTools.push(cmd);
			}
		}

		if (missingTools.length) {
			results.issues.push({
				id: 'JDK_MISSING_PROGRAMS',
				type: 'warning',
				message: `JDK (Java Development Kit) at ${home} missing required programs: ${missingTools.join(', ')}
${process.env.JAVA_HOME
	? 'Please verify your __JAVA_HOME__ environment variable is correctly set to the JDK install location.\n'
		+ `__JAVA_HOME__ is currently set to "${process.env.JAVA_HOME}".`
	: 'Please set the __JAVA_HOME__ environment variable to the JDK install location and not the JRE (Java Runtime Environment).'
}
The __JAVA_HOME__ environment variable must point to the JDK and not the JRE (Java Runtime Environment).
You may want to reinstall the JDK by downloading it from __https://www.oracle.com/java/technologies/downloads/__
or __https://jdk.java.net/archive/__.`
			});
			return;
		}

		// get the version
		// try the 64-bit version first
		let { status, stdout, stderr } = spawnSync(jdkInfo.executables.javac, [ '-version', '-d64' ]);
		if (status !== 0) {
			// not the 64-bit version, try the 32-bit version
			({ status, stdout, stderr } = spawnSync(jdkInfo.executables.javac, [ '-version' ]));
		}
		if (status === 0) {
			const re = /^javac (.+?)(?:_(.+))?$/;
			const m = (stderr && stderr.trim().match(re)) || (stdout && stdout.trim().match(re));
			if (m) {
				jdkInfo.version = m[1];
				jdkInfo.build = m[2];
				jdkInfo.architecture = arch;
				// JDK 9 doesn't return the build number in javac like previous JDKs.
				// We must spawn java -version to obtain it
				// JDK 9: javac 9
				// JDK <= 1.8: javac 1.7.0_80
				// See https://openjdk.java.net/jeps/223 for spec on build/version strings now
				if (!jdkInfo.build) {
					({ status, stdout, stderr } = spawnSync(jdkInfo.executables.javac, [ '-version' ]));
					if (status === 0) {
						const m = stderr.trim().match(/\(build .+?\+(\d+(-[-a-zA-Z0-9.]+)?)\)/);
						jdkInfo.build = m?.[1];
					}
				}
				return jdkInfo;
			}
		}
	}));

	// Filter for only valid JDKs
	jdks = jdks.filter(Boolean);

	if (jdks.length) {
		for (const jdk of jdks) {
			results.jdks[`${jdk.version}_${jdk.build}`] = jdk;

			// only add the first jdk as it's probably the JAVA_HOME based one
			if (results.version === null) {
				Object.assign(results, jdk);
			}
		}
	} else {
		results.issues.push({
			id: 'JDK_NOT_INSTALLED',
			type: 'error',
			message: `JDK (Java Development Kit) not installed.
If you already have installed the JDK, verify your __JAVA_HOME__ environment variable is correctly set.
The JDK is required for Titanium and must be manually downloaded and installed from __https://www.oracle.com/java/technologies/downloads/__
or  __https://jdk.java.net/archive/__.`
		});
	}

	cache = results;
	return results;
};

function isJDK(dir) {
	if (fs.existsSync(path.join(dir, 'bin', `javac${exe}`))) {
		// try to find the jvm lib
		let libjvmLocations = [];

		if (process.platform === 'linux') {
			if (process.arch === 'x64') {
				libjvmLocations = [
					'lib/amd64/client/libjvm.so',
					'lib/amd64/server/libjvm.so',
					'jre/lib/amd64/client/libjvm.so',
					'jre/lib/amd64/server/libjvm.so',
					'lib/server/libjvm.so'
				];
			} else {
				libjvmLocations = [
					'lib/i386/client/libjvm.so',
					'lib/i386/server/libjvm.so',
					'jre/lib/i386/client/libjvm.so',
					'jre/lib/i386/server/libjvm.so'
				];
			}
		} else if (process.platform === 'darwin') {
			libjvmLocations = [
				'jre/lib/server/libjvm.dylib',
				'../Libraries/libjvm.dylib',
				'lib/server/libjvm.dylib'
			];
		} else if (process.platform === 'win32') {
			libjvmLocations = [
				'jre/bin/server/jvm.dll',
				'jre/bin/client/jvm.dll',
				'bin/server/jvm.dll'
			];
		}

		return libjvmLocations.some(p => fs.existsSync(expand(dir, p)));
	}
};
