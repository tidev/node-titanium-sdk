import { isWritable, isWritableSync } from '../../src/util/is-writable.js';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

function makeReadOnly(path: string): () => void {
	if (process.platform === 'win32') {
		// icacls can deny write via ACLs; chmod 0o444 doesn't prevent directory
		// writes on Windows (read-only attribute behaves differently)
		execFileSync('icacls', [path, '/deny', 'Everyone:(OI)(CI)(W)'], { windowsHide: true });
		return () => {
			execFileSync('icacls', [path, '/remove:d', 'Everyone'], { windowsHide: true });
		};
	}
	chmodSync(path, 0o444);
	return () => chmodSync(path, 0o755);
}

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
		await expect(isWritable(join(tmpDir, 'dir'))).resolves.toBe(true);
		await expect(isWritable(join(tmpDir, 'dir', 'test.txt'))).resolves.toBe(true);

		await writeFile(join(tmpDir, 'test.txt'), 'test');
		await expect(isWritable(join(tmpDir, 'test.txt'))).resolves.toBe(true);
		await mkdir(join(tmpDir, 'dir'), { recursive: true });
		await expect(isWritable(join(tmpDir, 'dir'))).resolves.toBe(true);
	});

	it('should return false if the path is not writable', async () => {
		const readOnlyDir = join(tmpDir, 'readonly');
		await mkdir(readOnlyDir, { recursive: true });
		const restore = makeReadOnly(readOnlyDir);
		try {
			await expect(isWritable(readOnlyDir)).resolves.toBe(false);
			await expect(isWritable(join(readOnlyDir, 'test.txt'))).resolves.toBe(false);
			await expect(isWritable(join(readOnlyDir, 'dir', 'test.txt'))).resolves.toBe(false);
		} finally {
			restore();
		}
	});
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

	it('should return false if the path is not writable', () => {
		const readOnlyDir = join(tmpDir, 'readonly');
		mkdirSync(readOnlyDir, { recursive: true });
		const restore = makeReadOnly(readOnlyDir);
		try {
			expect(isWritableSync(readOnlyDir)).toBe(false);
			expect(isWritableSync(join(readOnlyDir, 'test.txt'))).toBe(false);
			expect(isWritableSync(join(readOnlyDir, 'dir', 'test.txt'))).toBe(false);
		} finally {
			restore();
		}
	});
});
