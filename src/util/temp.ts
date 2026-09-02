import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface TempNameOptions {
	name?: string;
	prefix?: string;
	suffix?: string;
}

/**
 * Creates a temporary directory name.
 * @param options - The options for the temporary directory name.
 * @returns The name of the temporary directory.
 */
export function createTempName({ name, prefix, suffix }: TempNameOptions = {}): string {
	name = name ?? randomBytes(16).toString('hex');
	return `${prefix ? `${prefix}-` : ''}${name}${suffix ? `-${suffix}` : ''}`;
}

/**
 * Creates a temporary directory path.
 * @param options - The options for the temporary directory path.
 * @returns The path to the temporary directory.
 */
export function createTempPath(options?: TempNameOptions): string {
	return join(tmpdir(), createTempName(options));
}

/**
 * Creates a temporary directory.
 * @param options - The options for the temporary directory.
 * @returns The path to the temporary directory.
 */
export async function createTempDir(options?: TempNameOptions): Promise<string> {
	const tmpDir = join(tmpdir(), createTempName(options));
	await mkdir(tmpDir, { recursive: true });
	return tmpDir;
}

/**
 * Creates a temporary directory synchronously.
 * @param options - The options for the temporary directory.
 * @returns The path to the temporary directory.
 */
export function createTempDirSync(options?: TempNameOptions): string {
	const tmpDir = join(tmpdir(), createTempName(options));
	mkdirSync(tmpDir, { recursive: true });
	return tmpDir;
}
