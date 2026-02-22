import { lstatSync } from 'fs';

export function isDir(dir: string): boolean {
	try {
		return lstatSync(dir).isDirectory();
	} catch {
		return false;
	}
}
