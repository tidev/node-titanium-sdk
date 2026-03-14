import { isWritable, isWritableSync } from '../../src/util/is-writable.js';
import { randomBytes } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tmpDir: string;
beforeEach(async () => {
	tmpDir = join(
		tmpdir(),
		'node-titanium-sdk',
		`is-writable-test-${randomBytes(8).toString('hex')}`
	);
	await mkdir(tmpDir, { recursive: true });
});

afterEach(() => rm(tmpDir, { force: true, recursive: true }));

describe('isWritable()', () => {
	it('should return true if the path is writable', async () => {
		await expect(isWritable(tmpDir)).resolves.toBe(true);
		await expect(isWritable(join(tmpDir, 'test.txt'))).resolves.toBe(true);
		await expect(isWritable(join(tmpDir, 'dir', 'test.txt'))).resolves.toBe(true);
	});

	it.skipIf(process.getuid?.() === 0)(
		'should return false if the path is not writable',
		async () => {
			if (process.platform === 'darwin' || process.platform === 'linux') {
				await expect(isWritable(join('/bin', 'test.txt'))).resolves.toBe(false);
				await expect(isWritable(join('/bin', 'dir', 'test.txt'))).resolves.toBe(false);
			} else if (process.platform === 'win32') {
				const system32 = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
				await expect(isWritable(system32)).resolves.toBe(false);
				await expect(isWritable(join(system32, 'test.txt'))).resolves.toBe(false);
				await expect(isWritable(join(system32, 'dir', 'test.txt'))).resolves.toBe(false);
			}
		}
	);
});

describe('isWritableSync()', () => {
	it('should return true if the path is writable', () => {
		expect(isWritableSync(tmpDir)).toBe(true);
		expect(isWritableSync(join(tmpDir, 'test.txt'))).toBe(true);
		expect(isWritableSync(join(tmpDir, 'dir', 'test.txt'))).toBe(true);
	});

	it.skipIf(process.getuid?.() === 0)('should return false if the path is not writable', () => {
		if (process.platform === 'darwin' || process.platform === 'linux') {
			expect(isWritableSync(join('/bin', 'test.txt'))).toBe(false);
			expect(isWritableSync(join('/bin', 'dir', 'test.txt'))).toBe(false);
		} else if (process.platform === 'win32') {
			const system32 = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
			expect(isWritableSync(system32)).toBe(false);
			expect(isWritableSync(join(system32, 'test.txt'))).toBe(false);
			expect(isWritableSync(join(system32, 'dir', 'test.txt'))).toBe(false);
		}
	});
});
