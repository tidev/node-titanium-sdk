import { isWritable, isWritableSync } from '../../src/util/is-writable.js';
import { createTempDir } from '../../src/util/temp.js';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tmpDir: string;
beforeEach(async () => {
	tmpDir = await createTempDir({ prefix: 'node-titanium-sdk' });
});

afterEach(() => rm(tmpDir, { force: true, recursive: true }));

describe('isWritable()', () => {
	it('should return true if the path is writable', async () => {
		await expect(isWritable(tmpDir)).resolves.toBe(true);
		await expect(isWritable(join(tmpDir, 'test.txt'))).resolves.toBe(true);
		await expect(isWritable(join(tmpDir, 'dir'))).resolves.toBe(true);
		await expect(isWritable(join(tmpDir, 'dir', 'test.txt'))).resolves.toBe(true);

		await writeFile(join(tmpDir, 'test.txt'), 'test');
		await expect(isWritable(join(tmpDir, 'test.txt'))).resolves.toBe(true);
		await mkdir(join(tmpDir, 'dir'), { recursive: true });
		await expect(isWritable(join(tmpDir, 'dir'))).resolves.toBe(true);
	});

	it.skipIf(process.getuid?.() === 0)(
		'should return false if the path is not writable',
		async () => {
			if (process.platform === 'darwin' || process.platform === 'linux') {
				await chmod(tmpDir, 0o444);
				await expect(isWritable(join(tmpDir, 'test.txt'))).resolves.toBe(false);
				await expect(isWritable(join(tmpDir, 'dir', 'test.txt'))).resolves.toBe(false);
			} else if (process.platform === 'win32') {
				const winSxS = join(process.env.SystemRoot ?? 'C:\\Windows', 'WinSxS');
				await expect(isWritable(winSxS)).resolves.toBe(false);
				await expect(isWritable(join(winSxS, 'test.txt'))).resolves.toBe(false);
				await expect(isWritable(join(winSxS, 'dir', 'test.txt'))).resolves.toBe(false);
			}
		}
	);
});

describe('isWritableSync()', () => {
	it('should return true if the path is writable', async () => {
		expect(isWritableSync(tmpDir)).toBe(true);
		expect(isWritableSync(join(tmpDir, 'test.txt'))).toBe(true);
		expect(isWritableSync(join(tmpDir, 'dir'))).toBe(true);
		expect(isWritableSync(join(tmpDir, 'dir', 'test.txt'))).toBe(true);

		await writeFile(join(tmpDir, 'test.txt'), 'test');
		expect(isWritableSync(join(tmpDir, 'test.txt'))).toBe(true);
		await mkdir(join(tmpDir, 'dir'), { recursive: true });
		expect(isWritableSync(join(tmpDir, 'dir'))).toBe(true);
	});

	it.skipIf(process.getuid?.() === 0)(
		'should return false if the path is not writable',
		async () => {
			if (process.platform === 'darwin' || process.platform === 'linux') {
				await chmod(tmpDir, 0o444);
				await expect(isWritable(join(tmpDir, 'test.txt'))).resolves.toBe(false);
				await expect(isWritable(join(tmpDir, 'dir', 'test.txt'))).resolves.toBe(false);
			} else if (process.platform === 'win32') {
				const winSxS = join(process.env.SystemRoot ?? 'C:\\Windows', 'WinSxS');
				expect(isWritableSync(winSxS)).toBe(false);
				expect(isWritableSync(join(winSxS, 'test.txt'))).toBe(false);
				expect(isWritableSync(join(winSxS, 'dir', 'test.txt'))).toBe(false);
			}
		}
	);
});
