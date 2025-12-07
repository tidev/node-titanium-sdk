import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { config, resetConfig } from '../../src/config.js';
import { detect, JDK } from '../../src/jdk.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exe = process.platform === 'win32' ? '.exe' : '';

describe('JDK', function() {
	let javaHome: string | undefined;

	beforeAll(() => {
		javaHome = process.env.JAVA_HOME;
	});

	afterEach(() => {
		delete process.env.MOCK_STDOUT;
		delete process.env.MOCK_STDERR;
		delete process.env.MOCK_EXITCODE;
		resetConfig();
	});

	afterAll(() => {
		if (javaHome) {
			process.env.JAVA_HOME = javaHome;
		} else {
			delete process.env.JAVA_HOME;
		}
	});

	describe('load()', () => {
		it('should throw error if dir is not a string', async () => {
			await expect(JDK.load(undefined as any)).rejects
				.toThrowError(new TypeError('Expected JDK path to be a valid string'));
			await expect(JDK.load(123 as any)).rejects
				.toThrowError(new TypeError('Expected JDK path to be a valid string'));
		});

		it('should throw error if dir does not exist', async () => {
			await expect(JDK.load('doesnotexist')).rejects.toThrow('JDK path does not exist');
		});

		it('should error if dir is missing the JVM library', async () => {
			await expect(JDK.load(path.join(__dirname, 'mocks', 'empty'))).rejects
				.toThrow('Directory missing JVM library');
		});

		it('should error if dir is missing essential jdk tools', async () => {
			await expect(JDK.load(path.join(__dirname, 'mocks', 'incomplete-jdk'))).rejects
				.toThrow('Directory missing required program');
		});

		it('should detect JDK 1.6', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDERR = 'javac 1.6.0_45';
			const jdk = await JDK.load(dir);

			expect(jdk.build).toBe(45);
			expect(jdk.executables).toEqual({
				java: path.join(dir, 'bin', `java${exe}`),
				javac: path.join(dir, 'bin', `javac${exe}`),
				keytool: path.join(dir, 'bin', `keytool${exe}`),
				jarsigner: path.join(dir, 'bin', `jarsigner${exe}`),
			});
			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('1.6.0');
		});

		it('should detect JDK 1.7', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDERR = 'javac 1.7.0_80';
			const jdk = await JDK.load(dir);

			expect(jdk.build).toBe(80);
			expect(jdk.executables).toEqual({
				java: path.join(dir, 'bin', `java${exe}`),
				javac: path.join(dir, 'bin', `javac${exe}`),
				keytool: path.join(dir, 'bin', `keytool${exe}`),
				jarsigner: path.join(dir, 'bin', `jarsigner${exe}`),
			});
			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('1.7.0');
		});

		it('should detect JDK 1.8', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDERR = 'javac 1.8.0_92';
			const jdk = await JDK.load(dir);

			expect(jdk.build).toBe(92);
			expect(jdk.executables).toEqual({
				java: path.join(dir, 'bin', `java${exe}`),
				javac: path.join(dir, 'bin', `javac${exe}`),
				keytool: path.join(dir, 'bin', `keytool${exe}`),
				jarsigner: path.join(dir, 'bin', `jarsigner${exe}`),
			});
			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('1.8.0');
		});

		(process.platform === 'darwin' ? it : it.skip)(
			'should detect JDK 1.8 with macOS pathing',
			async () => {
				process.env.MOCK_STDERR = 'javac 1.8.0_92';
				const dir = path.join(__dirname, 'mocks', 'mock-jdk-darwin');
				const jdk = await JDK.load(dir);

				expect(jdk.build).toBe(92);
				expect(jdk.executables).toEqual({
					java: path.join(dir, 'Contents', 'Home', 'bin', `java${exe}`),
					javac: path.join(dir, 'Contents', 'Home', 'bin', `javac${exe}`),
					keytool: path.join(dir, 'Contents', 'Home', 'bin', `keytool${exe}`),
					jarsigner: path.join(dir, 'Contents', 'Home', 'bin', `jarsigner${exe}`),
				});
				expect(jdk.path).toBe(path.join(dir, 'Contents', 'Home'));
				expect(jdk.version).toBe('1.8.0');
			}
		);

		it('should detect JDK 9', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDOUT = 'javac 9';
			const jdk = await JDK.load(dir);

			expect(jdk.build).toBe(null);
			expect(jdk.executables).toEqual({
				java: path.join(dir, 'bin', `java${exe}`),
				javac: path.join(dir, 'bin', `javac${exe}`),
				keytool: path.join(dir, 'bin', `keytool${exe}`),
				jarsigner: path.join(dir, 'bin', `jarsigner${exe}`),
			});
			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('9');
		});

		(process.platform === 'darwin' ? it : it.skip)(
			'should detect JDK 9 with macOS pathing',
			async () => {
				const dir = path.join(__dirname, 'mocks', 'mock-jdk-darwin');
				process.env.MOCK_STDOUT = 'javac 9.0.1';
				const jdk = await JDK.load(dir);

				expect(jdk.build).toBe(null);
				expect(jdk.executables).toEqual({
					java: path.join(dir, 'Contents', 'Home', 'bin', `java${exe}`),
					javac: path.join(dir, 'Contents', 'Home', 'bin', `javac${exe}`),
					keytool: path.join(dir, 'Contents', 'Home', 'bin', `keytool${exe}`),
					jarsigner: path.join(dir, 'Contents', 'Home', 'bin', `jarsigner${exe}`),
				});
				expect(jdk.path).toBe(path.join(dir, 'Contents', 'Home'));
				expect(jdk.version).toBe('9.0.1');
			}
		);

		it('should detect JDK 20.0.1', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDOUT = 'javac 20.0.1';
			const jdk = await JDK.load(dir);

			expect(jdk.build).toBe(null);
			expect(jdk.executables).toEqual({
				java: path.join(dir, 'bin', `java${exe}`),
				javac: path.join(dir, 'bin', `javac${exe}`),
				keytool: path.join(dir, 'bin', `keytool${exe}`),
				jarsigner: path.join(dir, 'bin', `jarsigner${exe}`),
			});
			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('20.0.1');
		});

		it('should detect JDK 25', async () => {
			const dir = path.join(__dirname, 'mocks', 'mock-jdk');
			process.env.MOCK_STDOUT = 'javac 25';
			const jdk = await JDK.load(dir);

			expect(jdk.build).toBe(null);
			expect(jdk.executables).toEqual({
				java: path.join(dir, 'bin', `java${exe}`),
				javac: path.join(dir, 'bin', `javac${exe}`),
				keytool: path.join(dir, 'bin', `keytool${exe}`),
				jarsigner: path.join(dir, 'bin', `jarsigner${exe}`),
			});
			expect(jdk.path).toBe(dir);
			expect(jdk.version).toBe('25');
		});

		it('should not detect version if javac is bad', async () => {
			const dir = path.join(__dirname, 'mocks', 'bad-bin-jdk');
			await expect(JDK.load(dir)).rejects.toThrow('Failed to determine JDK version');
		});
	});

	describe('detect()', () => {
		it('should find JDKs', async () => {
			try {
				const dir = path.join(__dirname, 'mocks', 'mock-jdk');
				process.env.MOCK_STDOUT = 'javac 9';
				process.env.JAVA_HOME = dir;
				const { home, jdks } = await detect({ bypassCache: true });
				expect(home).toBe(dir);

				const jdk = jdks.find(jdk => jdk.path === dir);
				expect(jdk).toBeDefined();
				expect(jdk!.build).toBeNull();
				expect(jdk!.executables).toEqual({
					java: path.join(dir, 'bin', `java${exe}`),
					javac: path.join(dir, 'bin', `javac${exe}`),
					keytool: path.join(dir, 'bin', `keytool${exe}`),
					jarsigner: path.join(dir, 'bin', `jarsigner${exe}`),
				});
				expect(jdk!.path).toBe(dir);
				expect(jdk!.version).toBe('9');
			} finally {
				delete process.env.JAVA_HOME;
			}
		});

		it('should cache JDKs', async () => {
			try {
				const dir = path.join(__dirname, 'mocks', 'mock-jdk');
				process.env.MOCK_STDOUT = 'javac 9';
				process.env.JAVA_HOME = dir;
				const results1 = await detect({ bypassCache: true });
				const results2 = await detect();
				expect(results1).toBe(results2);
			} finally {
				delete process.env.JAVA_HOME;
			}
		});

		it('should find JDKs without JAVA_HOME', async () => {
			try {
				process.env.MOCK_STDOUT = 'javac 9';
				process.env.JAVA_HOME = 'does_not_exist';
				const { home } = await detect({ bypassCache: true });
				expect(home).toBeNull();
			} finally {
				delete process.env.JAVA_HOME;
			}
		});

		it('should return issues if no JDKs are found', async () => {
			delete process.env.JAVA_HOME;
			config.jdk.searchPaths = {
				[process.platform]: ['does_not_exist'],
			};
			const { jdks, issues } = await detect({ bypassCache: true });
			expect(jdks).toEqual([]);
			expect(issues).toBeInstanceOf(Array);
			expect(issues!.length).toBe(1);
			expect(issues![0].id).toBe('JDK_NOT_FOUND');
			expect(issues![0].type).toBe('error');
		});

		it('should return issues if no JDKs are found', async () => {
			delete process.env.JAVA_HOME;
			config.jdk.searchPaths = {
				[process.platform]: [path.join(__dirname, 'mocks', 'incomplete-jdk')],
			};
			const { jdks, issues } = await detect({ bypassCache: true });
			expect(jdks).toEqual([]);
			expect(issues).toBeInstanceOf(Array);
			expect(issues!.length).toBe(2);
			const sortedIssues = issues!.sort((a, b) => a.id.localeCompare(b.id));
			expect(sortedIssues[0].id).toBe('JDK_MISSING_PROGRAMS');
			expect(sortedIssues[0].type).toBe('warning');
			expect(sortedIssues[1].id).toBe('JDK_NOT_FOUND');
			expect(sortedIssues[1].type).toBe('error');
		});
	});
});
