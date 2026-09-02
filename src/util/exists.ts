import { lstatSync } from 'node:fs';
import { lstat } from 'node:fs/promises';

/**
 * Checks if a path exists using `lstat` instead of `fs.existsSync`. For some reason, on Windows
 * `fs.existsSync` returns false for symlinks that exist.
 *
 * @param path The path to check if it exists.
 * @returns True if the path exists, false otherwise.
 */
export async function exists(path: string): Promise<boolean> {
	try {
		await lstat(path);
		return true;
	} catch {
		return false;
	}
}

export function existsSync(path: string): boolean {
	try {
		lstatSync(path);
		return true;
	} catch {
		return false;
	}
}
