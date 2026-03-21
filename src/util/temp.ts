import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface TempNameOptions {
	prefix?: string;
	suffix?: string;
}

/**
 * Creates a temporary directory name.
 * @param options - The options for the temporary directory name.
 * @returns The name of the temporary directory.
 */
export function createTempDirName({ prefix, suffix }: TempNameOptions = {}): string {
	const name = randomBytes(16).toString('hex');
	return `${prefix ? `${prefix}-` : ''}${name}${suffix ? `-${suffix}` : ''}`;
}

/**
 * Creates a temporary directory path.
 * @param options - The options for the temporary directory path.
 * @returns The path to the temporary directory.
 */
export function createTempDirPath(options?: TempNameOptions): string {
	return join(tmpdir(), createTempDirName(options));
}

/**
 * Creates a temporary directory.
 * @param options - The options for the temporary directory.
 * @returns The path to the temporary directory.
 */
export async function createTempDir(options?: TempNameOptions): Promise<string> {
	const tmpDir = join(tmpdir(), createTempDirName(options));
	await mkdir(tmpDir, { recursive: true });
	return tmpDir;
}

/**
 * Creates a temporary directory synchronously.
 * @param options - The options for the temporary directory.
 * @returns The path to the temporary directory.
 */
export function createTempDirSync(options?: TempNameOptions): string {
	const tmpDir = join(tmpdir(), createTempDirName(options));
	mkdirSync(tmpDir, { recursive: true });
	return tmpDir;
}
