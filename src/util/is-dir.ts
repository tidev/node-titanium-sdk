import { statSync } from 'node:fs';

export function isDir(dir: string): boolean {
	try {
		return statSync(dir).isDirectory();
	} catch {
		return false;
	}
}
