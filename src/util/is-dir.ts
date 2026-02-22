import { lstatSync, statSync } from 'node:fs';

export function isDir(dir: string): boolean {
	try {
		return statSync(dir).isDirectory();
	} catch {
		// check if it's a symlink
		try {
			return lstatSync(dir).isDirectory();
		} catch {
			return false;
		}
	}
}
