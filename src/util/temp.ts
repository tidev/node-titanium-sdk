import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Creates a temporary directory name.
 * @param prefix - The prefix for the temporary directory.
 * @returns The name of the temporary directory.
 */
export function createTempDirName(prefix?: string): string {
	const name = randomBytes(16).toString('hex');
	return prefix ? `${prefix}-${name}` : name;
}

/**
 * Creates a temporary directory path.
 * @param prefix - The prefix for the temporary directory.
 * @returns The path to the temporary directory.
 */
export function createTempDirPath(prefix?: string): string {
	return join(tmpdir(), createTempDirName(prefix));
}

/**
 * Creates a temporary directory.
 * @param prefix - The prefix for the temporary directory.
 * @returns The path to the temporary directory.
 */
export async function createTempDir(prefix?: string): Promise<string> {
	const tmpDir = join(tmpdir(), createTempDirName(prefix));
	await mkdir(tmpDir, { recursive: true });
	return tmpDir;
}

/**
 * Creates a temporary directory synchronously.
 * @param prefix - The prefix for the temporary directory.
 * @returns The path to the temporary directory.
 */
export function createTempDirSync(prefix?: string): string {
	const tmpDir = join(tmpdir(), createTempDirName(prefix));
	mkdirSync(tmpDir, { recursive: true });
	return tmpDir;
}
