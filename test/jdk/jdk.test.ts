import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { findJDKs, JDK } from '../../src/jdk.js';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('JDK', function () {
	this.timeout(5000);

	it('should throw error if dir is not a string', () => {
		expect(() => {
			new JDK(undefined as any);
		}).to.throw(TypeError, 'Expected directory to be a valid string');

		expect(() => {
			new JDK(123 as any);
		}).to.throw(TypeError, 'Expected directory to be a valid string');
	});

	it('should throw error if dir does not exist', async () => {
		await expect(detect('doesnotexist')).to.be.rejectedWith(Error, 'Directory does not exist');
	});

	it('should error if dir is missing the JVM library', async () => {
		await expect(detect(path.join(__dirname, 'mocks', 'empty'))).to.be.rejectedWith(Error, 'Directory missing JVM library');
	});

	it('should error if dir is missing essential jdk tools', async () => {
		await expect(detect(path.join(__dirname, 'mocks', 'incomplete-jdk'))).to.be.rejectedWith(Error, 'Directory missing required program');
	});

	it('should detect JDK 1.6', async () => {
		const dir = path.join(__dirname, 'mocks', 'jdk-1.6');
		const jdk = await detect(dir);

		expect(jdk.arch).to.equal('64bit');
		expect(jdk.build).to.equal(45);
		expect(jdk.executables).to.deep.equal({
			java:      path.join(dir, 'bin', 'java' + exe),
			javac:     path.join(dir, 'bin', 'javac' + exe),
			keytool:   path.join(dir, 'bin', 'keytool' + exe),
			jarsigner: path.join(dir, 'bin', 'jarsigner' + exe)
		});
		expect(jdk.path).to.equal(dir);
		expect(jdk.version).to.equal('1.6.0');
	});

	it('should detect JDK 1.7', async () => {
		const dir = path.join(__dirname, 'mocks', 'jdk-1.7');
		const jdk = await detect(dir);

		expect(jdk.arch).to.equal('64bit');
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
		const jdk = await detect(dir);

		expect(jdk.arch).to.equal('64bit');
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

	it('should detect JDK 1.8 32-bit', async () => {
		const dir = path.join(__dirname, 'mocks', 'jdk-1.8-32bit');
		const jdk = await detect(dir);

		expect(jdk.arch).to.equal('32bit');
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

	(process.platform === 'darwin' ? it : it.skip)('should detect JDK 1.8 64-bit with macOS pathing', async () => {
		const dir = path.join(__dirname, 'mocks', 'jdk-1.8-darwin');
		const jdk = await detect(dir);

		expect(jdk.arch).to.equal('64bit');
		expect(jdk.build).to.equal(92);
		expect(jdk.executables).to.deep.equal({
			java:      path.join(dir, 'Contents', 'Home', 'bin', 'java' + exe),
			javac:     path.join(dir, 'Contents', 'Home', 'bin', 'javac' + exe),
			keytool:   path.join(dir, 'Contents', 'Home', 'bin', 'keytool' + exe),
			jarsigner: path.join(dir, 'Contents', 'Home', 'bin', 'jarsigner' + exe)
		});
		expect(jdk.path).to.equal(path.join(dir, 'Contents', 'Home'));
		expect(jdk.version).to.equal('1.8.0');
	});

	it('should detect JDK 9', async () => {
		const dir = path.join(__dirname, 'mocks', 'jdk-9');
		const jdk = await detect(dir);

		expect(jdk.arch).to.equal('64bit');
		expect(jdk.build).to.equal(181);
		expect(jdk.executables).to.deep.equal({
			java:      path.join(dir, 'bin', 'java' + exe),
			javac:     path.join(dir, 'bin', 'javac' + exe),
			keytool:   path.join(dir, 'bin', 'keytool' + exe),
			jarsigner: path.join(dir, 'bin', 'jarsigner' + exe)
		});
		expect(jdk.path).to.equal(dir);
		expect(jdk.version).to.equal('9');
	});

	(process.platform === 'darwin' ? it : it.skip)('should detect JDK 9 with macOS pathing', async () => {
		const dir = path.join(__dirname, 'mocks', 'jdk-9-darwin');
		const jdk = await detect(dir);

		expect(jdk.arch).to.equal('64bit');
		expect(jdk.build).to.equal(11);
		expect(jdk.executables).to.deep.equal({
			java:      path.join(dir, 'Contents', 'Home', 'bin', 'java' + exe),
			javac:     path.join(dir, 'Contents', 'Home', 'bin', 'javac' + exe),
			keytool:   path.join(dir, 'Contents', 'Home', 'bin', 'keytool' + exe),
			jarsigner: path.join(dir, 'Contents', 'Home', 'bin', 'jarsigner' + exe)
		});
		expect(jdk.path).to.equal(path.join(dir, 'Contents', 'Home'));
		expect(jdk.version).to.equal('9.0.1');
	});

	it('should not detect version or arch if javac is not found', async () => {
		const dir = path.join(__dirname, 'mocks', 'bad-bin-jdk');
		let jdk = new JDK(dir);
		delete jdk.executables.javac;
		jdk = await jdk.init();

		expect(jdk.arch).to.be.null;
		expect(jdk.build).to.be.null;
		expect(jdk.executables).to.deep.equal({
			java:      path.join(dir, 'bin', 'java' + exe),
			keytool:   path.join(dir, 'bin', 'keytool' + exe),
			jarsigner: path.join(dir, 'bin', 'jarsigner' + exe)
		});
		expect(jdk.path).to.equal(dir);
		expect(jdk.version).to.be.null;
	});

	it('should not detect version if javac is bad', async () => {
		const dir = path.join(__dirname, 'mocks', 'bad-bin-jdk');
		const jdk = await detect(dir);

		expect(jdk.arch).to.be.null;
		expect(jdk.build).to.be.null;
		expect(jdk.executables).to.deep.equal({
			java:      path.join(dir, 'bin', 'java' + exe),
			javac:     path.join(dir, 'bin', 'javac' + exe),
			keytool:   path.join(dir, 'bin', 'keytool' + exe),
			jarsigner: path.join(dir, 'bin', 'jarsigner' + exe)
		});
		expect(jdk.path).to.equal(dir);
		expect(jdk.version).to.be.null;
	});
});
