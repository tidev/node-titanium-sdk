import { config, resetConfig } from '../../src/config.js';
import { detectJDKs, JDK } from '../../src/jdk.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exe = process.platform === 'win32' ? '.exe' : '';

describe('JDK', function () {
	let javaHome: string | undefined;

	beforeAll(() => {
		javaHome = process.env.JAVA_HOME;
	});

	afterEach(() => {
		delete process.env.MOCK_STDOUT;
		delete process.env.MOCK_STDERR;
		delete process.env.MOCK_EXITCODE;
		resetConfig();

		if (javaHome) {
			process.env.JAVA_HOME = javaHome;
		} else {
			delete process.env.JAVA_HOME;
		}
	});

	describe('load()', () => {
		it('should throw error if dir is not a string', async () => {
			await expect(JDK.load(undefined as any)).rejects.toThrowError(
				new TypeError('Expected JDK path to be a valid string')
			);
			await expect(JDK.load(123 as any)).rejects.toThrowError(
				new TypeError('Expected JDK path to be a valid string')
			);
		});

		it('should throw error if dir does not exist', async () => {
			await expect(JDK.load('doesnotexist')).rejects.toThrow('JDK path does not exist');
		});

		it('should error if dir is missing essential jdk tools', async () => {
			await expect(JDK.load(path.join(__dirname, 'mocks', 'incomplete-jdk'))).rejects.toThrow(
				'Directory missing required program'
			);
		});

		it('should detect JDK 1.6', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDERR = 'javac 1.6.0_45';
			const jdk = await JDK.load(dir);

			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('1.6.0');
			expect(jdk.java).toBe(path.join(dir, 'bin', `java${exe}`));
			expect(jdk.javac).toBe(path.join(dir, 'bin', `javac${exe}`));
			expect(jdk.keytool).toBe(path.join(dir, 'bin', `keytool${exe}`));
			expect(jdk.jarsigner).toBe(path.join(dir, 'bin', `jarsigner${exe}`));
		});

		it('should detect JDK 1.7', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDERR = 'javac 1.7.0_80';
			const jdk = await JDK.load(dir);

			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('1.7.0');
			expect(jdk.java).toBe(path.join(dir, 'bin', `java${exe}`));
			expect(jdk.javac).toBe(path.join(dir, 'bin', `javac${exe}`));
			expect(jdk.keytool).toBe(path.join(dir, 'bin', `keytool${exe}`));
			expect(jdk.jarsigner).toBe(path.join(dir, 'bin', `jarsigner${exe}`));
		});

		it('should detect JDK 1.8', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDERR = 'javac 1.8.0_92';
			const jdk = await JDK.load(dir);

			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('1.8.0');
			expect(jdk.java).toBe(path.join(dir, 'bin', `java${exe}`));
			expect(jdk.javac).toBe(path.join(dir, 'bin', `javac${exe}`));
			expect(jdk.keytool).toBe(path.join(dir, 'bin', `keytool${exe}`));
			expect(jdk.jarsigner).toBe(path.join(dir, 'bin', `jarsigner${exe}`));
		});

		(process.platform === 'darwin' ? it : it.skip)(
			'should detect JDK 1.8 with macOS pathing',
			async () => {
				process.env.MOCK_STDERR = 'javac 1.8.0_92';
				const dir = path.join(__dirname, 'mocks', 'mock-jdk-darwin');
				const jdk = await JDK.load(dir);

				expect(jdk.path).toBe(path.join(dir, 'Contents', 'Home'));
				expect(jdk.version).toBe('1.8.0');
				expect(jdk.java).toBe(path.join(dir, 'Contents', 'Home', 'bin', `java${exe}`));
				expect(jdk.javac).toBe(path.join(dir, 'Contents', 'Home', 'bin', `javac${exe}`));
				expect(jdk.keytool).toBe(path.join(dir, 'Contents', 'Home', 'bin', `keytool${exe}`));
				expect(jdk.jarsigner).toBe(path.join(dir, 'Contents', 'Home', 'bin', `jarsigner${exe}`));
			}
		);

		it('should detect JDK 9', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDOUT = 'javac 9';
			const jdk = await JDK.load(dir);

			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('9');
			expect(jdk.java).toBe(path.join(dir, 'bin', `java${exe}`));
			expect(jdk.javac).toBe(path.join(dir, 'bin', `javac${exe}`));
			expect(jdk.keytool).toBe(path.join(dir, 'bin', `keytool${exe}`));
			expect(jdk.jarsigner).toBe(path.join(dir, 'bin', `jarsigner${exe}`));
		});

		(process.platform === 'darwin' ? it : it.skip)(
			'should detect JDK 9 with macOS pathing',
			async () => {
				const dir = path.join(__dirname, 'mocks', 'mock-jdk-darwin');
				process.env.MOCK_STDOUT = 'javac 9.0.1';
				const jdk = await JDK.load(dir);

				expect(jdk.path).toBe(path.join(dir, 'Contents', 'Home'));
				expect(jdk.version).toBe('9.0.1');
				expect(jdk.java).toBe(path.join(dir, 'Contents', 'Home', 'bin', `java${exe}`));
				expect(jdk.javac).toBe(path.join(dir, 'Contents', 'Home', 'bin', `javac${exe}`));
				expect(jdk.keytool).toBe(path.join(dir, 'Contents', 'Home', 'bin', `keytool${exe}`));
				expect(jdk.jarsigner).toBe(path.join(dir, 'Contents', 'Home', 'bin', `jarsigner${exe}`));
			}
		);

		it('should detect JDK 20.0.1', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDOUT = 'javac 20.0.1';
			const jdk = await JDK.load(dir);

			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('20.0.1');
			expect(jdk.java).toBe(path.join(dir, 'bin', `java${exe}`));
			expect(jdk.javac).toBe(path.join(dir, 'bin', `javac${exe}`));
			expect(jdk.keytool).toBe(path.join(dir, 'bin', `keytool${exe}`));
			expect(jdk.jarsigner).toBe(path.join(dir, 'bin', `jarsigner${exe}`));
		});

		it('should detect JDK 25', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDOUT = 'javac 25';
			const jdk = await JDK.load(dir);

			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('25');
			expect(jdk.java).toBe(path.join(dir, 'bin', `java${exe}`));
			expect(jdk.javac).toBe(path.join(dir, 'bin', `javac${exe}`));
			expect(jdk.keytool).toBe(path.join(dir, 'bin', `keytool${exe}`));
			expect(jdk.jarsigner).toBe(path.join(dir, 'bin', `jarsigner${exe}`));
		});

		it('should not detect version if javac is bad', async () => {
			const dir = path.join(__dirname, 'mocks', 'bad-bin-jdk');
			await expect(JDK.load(dir)).rejects.toThrow('Failed to determine JDK version');
		});
	});

	describe('detectJDKs()', () => {
		it('should find JDKs', async () => {
			try {
				const dir = path.join(__dirname, 'mocks', 'mock-jdk');
				process.env.MOCK_STDOUT = 'javac 9';
				process.env.JAVA_HOME = dir;
				const { home, jdks } = await detectJDKs();
				expect(home).toBe(dir);

				const jdk = jdks.find((jdk) => jdk.path === dir);
				expect(jdk).toBeDefined();
				expect(jdk!.path).toBe(dir);
				expect(jdk!.version).toBe('9');
				expect(jdk!.java).toBe(path.join(dir, 'bin', `java${exe}`));
				expect(jdk!.javac).toBe(path.join(dir, 'bin', `javac${exe}`));
				expect(jdk!.keytool).toBe(path.join(dir, 'bin', `keytool${exe}`));
				expect(jdk!.jarsigner).toBe(path.join(dir, 'bin', `jarsigner${exe}`));
			} finally {
				delete process.env.JAVA_HOME;
			}
		}, 60_000);

		it('should find JDKs without JAVA_HOME', async () => {
			const javaHome = process.env.JAVA_HOME;
			try {
				process.env.MOCK_STDOUT = 'javac 9';
				process.env.JAVA_HOME = 'does_not_exist';
				const { home } = await detectJDKs();
				expect(home).toBeNull();
			} finally {
				if (javaHome) {
					process.env.JAVA_HOME = javaHome;
				} else {
					delete process.env.JAVA_HOME;
				}
			}
		});

		it('should return issues if no JDKs are found', async () => {
			delete process.env.JAVA_HOME;
			config.jdk.searchPaths[process.platform] = ['does_not_exist'];
			const { jdks, issues } = await detectJDKs();
			expect(jdks).toEqual([]);
			expect(issues.length).toBe(1);
			expect(issues[0].id).toBe('JDK_NOT_FOUND');
			expect(issues[0].type).toBe('error');
		});

		it('should return issues if no valid JDKs are found', async () => {
			delete process.env.JAVA_HOME;
			config.jdk.searchPaths[process.platform] = [];
			const { jdks, issues } = await detectJDKs({
				searchPaths: [path.join(__dirname, 'mocks', 'incomplete-jdk')],
			});
			expect(jdks).toEqual([]);
			expect(issues.length).toBe(1);
			expect(issues[0].id).toBe('JDK_NOT_FOUND');
			expect(issues[0].type).toBe('error');
		});

		it('should return issues if JDK path contains ampersand', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk-&ampersand');
			config.jdk.searchPaths[process.platform] = [dir];
			process.env.MOCK_STDOUT = 'javac 25';
			delete process.env.JAVA_HOME;
			const { jdks, issues } = await detectJDKs();

			expect(jdks).toHaveLength(1);
			const jdk = jdks[0];
			expect(jdk).toBeDefined();

			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('25');
			expect(jdk.java).toBe(path.join(dir, 'bin', `java${exe}`));
			expect(jdk.javac).toBe(path.join(dir, 'bin', `javac${exe}`));
			expect(jdk.keytool).toBe(path.join(dir, 'bin', `keytool${exe}`));
			expect(jdk.jarsigner).toBe(path.join(dir, 'bin', `jarsigner${exe}`));

			if (process.platform === 'win32') {
				expect(issues.length).toBe(1);
				expect(issues[0].id).toBe('JDK_PATH_CONTAINS_AMPERSAND');
				expect(issues[0].type).toBe('warning');
			} else {
				expect(issues).toEqual([]);
			}
		});
	});
});
