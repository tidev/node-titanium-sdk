import { lstatSync, statSync } from 'node:fs';

export function isFile(file: string): boolean {
	try {
		return statSync(file).isFile();
	} catch {
		// check if it's a symlink
		try {
			return lstatSync(file).isFile();
		} catch {
			return false;
		}
	}
}
