import { exists, existsSync } from '../../src/util/exists.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { canSymlink } from './can-symlink.js';

let tmpDir: string;
beforeEach(async () => {
	tmpDir = join(tmpdir(), 'node-titanium-sdk', `zip-test-${randomBytes(8).toString('hex')}`);
	await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
	if (existsSync(tmpDir)) {
		await rm(tmpDir, { force: true, recursive: true });
	}
});

describe('exists', () => {
	it('should return true if a file exists', async () => {
		await writeFile(join(tmpDir, 'test.txt'), 'test');
		expect(await exists(join(tmpDir, 'test.txt'))).toBe(true);
	});

	it('should return true if a directory exists', async () => {
		await mkdir(join(tmpDir, 'test'), { recursive: true });
		expect(await exists(join(tmpDir, 'test'))).toBe(true);
	});

	it('should return false if a file does not exist', async () => {
		expect(await exists(join(tmpDir, 'test.txt'))).toBe(false);
	});

	it('should return false if a directory does not exist', async () => {
		expect(await exists(join(tmpDir, 'test'))).toBe(false);
	});

	it.skipIf(!canSymlink())('should return true if a symlink exists', async () => {
		await symlink(join(tmpDir, 'test.txt'), join(tmpDir, 'link.txt'));
		expect(await exists(join(tmpDir, 'link.txt'))).toBe(true);
	});

	it.skipIf(!canSymlink())('should return true if a broken symlink exists', async () => {
		await symlink(join(tmpDir, 'does_not_exist.txt'), join(tmpDir, 'link.txt'));
		expect(await exists(join(tmpDir, 'link.txt'))).toBe(true);
	});
});

describe('existsSync', () => {
	it('should return true if a file exists', async () => {
		await writeFile(join(tmpDir, 'test.txt'), 'test');
		expect(existsSync(join(tmpDir, 'test.txt'))).toBe(true);
	});

	it('should return true if a directory exists', async () => {
		await mkdir(join(tmpDir, 'test'), { recursive: true });
		expect(existsSync(join(tmpDir, 'test'))).toBe(true);
	});

	it('should return false if a file does not exist', async () => {
		expect(existsSync(join(tmpDir, 'test.txt'))).toBe(false);
	});

	it('should return false if a directory does not exist', async () => {
		expect(existsSync(join(tmpDir, 'test'))).toBe(false);
	});

	it.skipIf(!canSymlink())('should return true if a symlink exists', async () => {
		await symlink(join(tmpDir, 'test.txt'), join(tmpDir, 'link.txt'));
		expect(existsSync(join(tmpDir, 'link.txt'))).toBe(true);
	});

	it.skipIf(!canSymlink())('should return true if a broken symlink exists', async () => {
		await symlink(join(tmpDir, 'does_not_exist.txt'), join(tmpDir, 'link.txt'));
		expect(existsSync(join(tmpDir, 'link.txt'))).toBe(true);
	});
});
