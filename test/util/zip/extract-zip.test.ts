import { exists, extractZip, isDir, isFile } from '../../../src/util/index.js';
import { canSymlink } from '../can-symlink.js';
import { randomBytes } from 'node:crypto';
import { lstatSync, readlinkSync, statSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures');

let tmpDir: string;
beforeEach(async () => {
	tmpDir = join(tmpdir(), 'node-titanium-sdk', `zip-test-${randomBytes(8).toString('hex')}`);
	await mkdir(tmpDir, { recursive: true });
});

afterEach(() => rm(tmpDir, { force: true, recursive: true }));

describe('extractZip()', () => {
	it('should error if zip file is invalid', async () => {
		await expect(extractZip(null as any, undefined as any)).rejects.toThrowError(
			new TypeError('Expected zip file to be a non-empty string')
		);
		await expect(extractZip(undefined as any, undefined as any)).rejects.toThrowError(
			new TypeError('Expected zip file to be a non-empty string')
		);
		await expect(extractZip(123 as any, undefined as any)).rejects.toThrowError(
			new TypeError('Expected zip file to be a non-empty string')
		);
	});

	it('should error if zip file does not exist', async () => {
		await expect(extractZip('does_not_exist.zip', undefined as any)).rejects.toThrow(
			'The specified zip file does not exist'
		);
	});

	it('should error if zip file is not a file', async () => {
		await expect(extractZip(fixturesDir, undefined as any)).rejects.toThrowError(
			new Error('The specified zip file is not a file')
		);
	});

	it('should error if dest is invalid', async () => {
		await expect(extractZip(join(fixturesDir, 'files.zip'), 123 as any)).rejects.toThrowError(
			new TypeError('Expected destination directory to be a non-empty string')
		);
		await expect(extractZip(join(fixturesDir, 'files.zip'), null as any)).rejects.toThrowError(
			new TypeError('Expected destination directory to be a non-empty string')
		);
		await expect(extractZip(join(fixturesDir, 'files.zip'), undefined as any)).rejects.toThrowError(
			new TypeError('Expected destination directory to be a non-empty string')
		);
	});

	it('should error if file is invalid', async () => {
		await expect(() => extractZip(join(fixturesDir, 'invalid.zip'), tmpDir)).rejects.toThrow(
			'Invalid zip file:'
		);
	});

	it('should extract zip file to destination and overwrite', async () => {
		await mkdir(join(tmpDir, 'testfiles'), { recursive: true });
		await writeFile(join(tmpDir, 'testfiles', 'a.txt'), 'I will be overwritten', 'utf8');

		const files: string[] = [];
		const expectedFiles = [
			'testfiles/',
			...Array.from({ length: 26 }, (_, i) =>
				posix.join('testfiles', `${String.fromCharCode(97 + i)}.txt`)
			),
		].sort();

		await extractZip(join(fixturesDir, 'files.zip'), tmpDir, {
			onEntry: (entry) => {
				files.push(entry.fileName);
			},
		});

		expect(files.sort()).toEqual(expectedFiles);

		let i = 0;
		const listing = (await readdir(join(tmpDir, 'testfiles'))).sort();
		for (const file of listing) {
			expect(file).toBe(`${String.fromCharCode(97 + i++)}.txt`);
			expect(await readFile(join(tmpDir, 'testfiles', file), 'utf8')).toBe(`This is a test`);
		}
	});

	it.skipIf(!canSymlink())('should extract a file with symlinks', async () => {
		await extractZip(join(fixturesDir, 'symlinks.zip'), tmpDir);

		const folder = join(tmpDir, 'symlinks/folder');
		expect(isDir(folder)).toBe(true);

		const file = join(tmpDir, 'symlinks/folder/testfile.txt');
		expect(isFile(file)).toBe(true);

		const fileLink = join(tmpDir, 'symlinks/link.txt');
		expect(await exists(fileLink)).toBe(true);
		const fileLinkStat = lstatSync(fileLink);
		expect(fileLinkStat.isSymbolicLink()).toBe(true);

		const folderLink = join(tmpDir, 'symlinks/folderlink');
		const folderLinkStat = lstatSync(folderLink);
		expect(folderLinkStat.isSymbolicLink()).toBe(true);
		const target = readlinkSync(folderLink);
		expect(target).to.equal('folder');
	});

	it.skipIf(!canSymlink())('should handle if a symlink already exists', async () => {
		await extractZip(join(fixturesDir, 'symlinks.zip'), tmpDir);

		await extractZip(join(fixturesDir, 'symlinks.zip'), tmpDir);

		const folder = join(tmpDir, 'symlinks/folder');
		expect(isDir(folder)).toBe(true);

		const file = join(tmpDir, 'symlinks/folder/testfile.txt');
		expect(isFile(file)).toBe(true);

		const fileLink = join(tmpDir, 'symlinks/link.txt');
		expect(await exists(fileLink)).toBe(true);

		const folderLink = join(tmpDir, 'symlinks/folderlink');
		const folderLinkStat = lstatSync(folderLink);
		expect(folderLinkStat.isSymbolicLink()).toBe(true);
		const target = readlinkSync(folderLink);
		expect(target).toBe('folder');
	});

	it.skipIf(process.platform === 'win32')('should preserve executable permissions', async () => {
		await extractZip(join(fixturesDir, 'shellscript.zip'), tmpDir);

		const file = join(tmpDir, 'testexe/test.sh');
		expect(await exists(file)).toBe(true);
		expect(isFile(file)).toBe(true);
		expect(statSync(file).mode & 0o777).toBe(0o755);
	});
});
