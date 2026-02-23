import { config } from '../config.js';
import { exists, expand, isDir } from '../util/index.js';
import { Issue } from '../util/issue.js';
import { tailgate } from '../util/tailgate.js';
import { JDK } from './jdk.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import snooplogg from 'snooplogg';
import which from 'which';

const { warn } = snooplogg('jdk:detect');

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
		const jdkPaths = new Set<string>();
		const issues: Issue[] = [];

		async function processPath(
			path: string,
			depth: number
		): Promise<{ jdk: JDK | null; subdirs: string[] }> {
			try {
				const jdk = await JDK.load(path);
				return { jdk, subdirs: [] };
			} catch (err) {
				if (err instanceof Error && 'code' in err && err.code === 'JDK_MISSING_REQUIRED_PROGRAM') {
					if (depth === 0) {
						const subdirs: string[] = [];
						for (const name of await readdir(path)) {
							const dir = join(path, name);
							if (isDir(dir)) {
								subdirs.push(dir);
							}
						}
						return { jdk: null, subdirs };
					}
					warn(err);
					return { jdk: null, subdirs: [] };
				}
				if (err instanceof Issue) {
					warn(err.message);
					issues.push(err);
					return { jdk: null, subdirs: [] };
				}
				warn(err);
				return { jdk: null, subdirs: [] };
			}
		}

		const level0Results = await Promise.all(searchPaths.map((path) => processPath(path, 0)));
		const subdirs: string[] = [];
		for (const { jdk, subdirs: s } of level0Results) {
			if (jdk && !jdkPaths.has(jdk.path)) {
				jdkPaths.add(jdk.path);
				jdks.push(jdk);
			}
			subdirs.push(...s);
		}

		const level1Results = await Promise.all(subdirs.map((path) => processPath(path, 1)));
		for (const { jdk } of level1Results) {
			if (jdk && !jdkPaths.has(jdk.path)) {
				jdkPaths.add(jdk.path);
				jdks.push(jdk);
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
		if (await exists(home)) {
			searchPaths.add(home);
		} else {
			home = null;
		}
	}

	if (process.platform === 'win32') {
		// TODO: check the Windows Registry
		// config.jdk.windows.registryKeys
	}

	const exe = process.platform === 'win32' ? '.exe' : '';
	const javacPath = await which(`javac${exe}`, { nothrow: true });
	if (javacPath) {
		searchPaths.add(expand(javacPath, '..'));
	}

	return {
		home,
		searchPaths: Array.from(searchPaths),
	};
}
