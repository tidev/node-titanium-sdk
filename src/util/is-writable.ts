import { createTempDirName } from './temp.js';
import { accessSync, constants, statSync, unlinkSync, writeFileSync, type Stats } from 'node:fs';
import { access, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function isWritable(path: string): Promise<boolean> {
	let stat: Stats | undefined;
	try {
		stat = statSync(path);
	} catch {
		// path does not exist, check if parent is writable
		return isWritable(dirname(path));
	}

	try {
		if (stat.isFile()) {
			await access(path, constants.W_OK);
			return true;
		} else if (stat.isDirectory()) {
			// try writing a file
			const tmpFile = join(path, createTempDirName('tmp'));
			try {
				await access(path, constants.W_OK);
				await writeFile(tmpFile, '', 'utf-8');
				return true;
			} finally {
				await unlink(tmpFile);
			}
		}
	} catch {}

	return false;
}

export function isWritableSync(path: string): boolean {
	let stat: Stats | undefined;
	try {
		stat = statSync(path);
	} catch {
		// path does not exist, check if parent is writable
		return isWritableSync(dirname(path));
	}

	try {
		if (stat.isFile()) {
			accessSync(path, constants.W_OK);
			return true;
		} else if (stat.isDirectory()) {
			// try writing a file
			const tmpFile = join(path, createTempDirName('tmp'));
			try {
				accessSync(path, constants.W_OK);
				writeFileSync(tmpFile, '', 'utf-8');
				return true;
			} finally {
				unlinkSync(tmpFile);
			}
		}
	} catch {}

	return false;
}
