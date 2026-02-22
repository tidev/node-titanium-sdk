import { lstatSync } from 'fs';

export function isFile(file: string): boolean {
	try {
		return lstatSync(file).isFile();
	} catch {
		return false;
	}
}
