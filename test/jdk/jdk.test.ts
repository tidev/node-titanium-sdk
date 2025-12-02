import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { findJDKs, JDK } from '../../src/jdk.js';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exe = process.platform === 'win32' ? '.exe' : '';

describe('JDK', function () {
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
		const dir = path.join(__dirname, 'mocks', 'jdk-1.6');
		const jdk = await JDK.load(dir);

		expect(jdk.build).to.equal(45);
		expect(jdk.executables).to.deep.equal({
			java:      path.join(dir, 'bin', `java${exe}`),
			javac:     path.join(dir, 'bin', `javac${exe}`),
			keytool:   path.join(dir, 'bin', `keytool${exe}`),
			jarsigner: path.join(dir, 'bin', `jarsigner${exe}`)
		});
		expect(jdk.path).to.equal(dir);
		expect(jdk.version).to.equal('1.6.0');
	});

	it('should detect JDK 1.7', async () => {
		const dir = path.join(__dirname, 'mocks', 'jdk-1.7');
		const jdk = await JDK.load(dir);

		expect(jdk.build).to.equal(80);
		expect(jdk.executables).to.deep.equal({
			java:      path.join(dir, 'bin', 'java' + exe),
			javac:     path.join(dir, 'bin', 'javac' + exe),
			keytool:   path.join(dir, 'bin', 'keytool' + exe),
			jarsigner: path.join(dir, 'bin', 'jarsigner' + exe)
		});
		expect(jdk.path).to.equal(dir);
		expect(jdk.version).to.equal('1.7.0');
	});

	it('should detect JDK 1.8 64-bit', async () => {
		const dir = path.join(__dirname, 'mocks', 'jdk-1.8');
		const jdk = await JDK.load(dir);

		expect(jdk.build).to.equal(92);
		expect(jdk.executables).to.deep.equal({
			java:      path.join(dir, 'bin', 'java' + exe),
			javac:     path.join(dir, 'bin', 'javac' + exe),
			keytool:   path.join(dir, 'bin', 'keytool' + exe),
			jarsigner: path.join(dir, 'bin', 'jarsigner' + exe)
		});
		expect(jdk.path).to.equal(dir);
		expect(jdk.version).to.equal('1.8.0');
	});

	it('should detect JDK 9', async () => {
		const dir = path.join(__dirname, 'mocks', 'jdk-9');
		const jdk = await JDK.load(dir);

		expect(jdk.build).to.equal(null);
		expect(jdk.executables).to.deep.equal({
			java:      path.join(dir, 'bin', 'java' + exe),
			javac:     path.join(dir, 'bin', 'javac' + exe),
			keytool:   path.join(dir, 'bin', 'keytool' + exe),
			jarsigner: path.join(dir, 'bin', 'jarsigner' + exe)
		});
		expect(jdk.path).to.equal(dir);
		expect(jdk.version).to.equal('9');
	});

	it('should not detect version if javac is bad', async () => {
		const dir = path.join(__dirname, 'mocks', 'bad-bin-jdk');
		await expect(JDK.load(dir)).rejects.toThrow('Failed to determine JDK version');
	});
});

describe('findJDKs', function () {
	it('should find JDKs', async () => {
		const jdks = await findJDKs();
		console.log(jdks);
		// TODO
	});
});
