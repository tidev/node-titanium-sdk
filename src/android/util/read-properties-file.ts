import { readFile } from 'node:fs/promises';
import { isFile } from '../../util/is-file.js';

/**
 * Cached regex for matching key/values in properties files.
 */
const pkgPropRegExp = /^(?!\s*#)\s*([^=\s]+)\s*=\s*(.+?)\s*$/;

/**
 * Reads and parses the specified properties file into an object.
 *
 * @param file - The properties file to parse.
 * @returns A record of key/values from the properties file, or `null` if the
 * file does not exist.
 */
export async function readPropertiesFile(file: string): Promise<Record<string, string> | null> {
	if (!isFile(file)) {
		return null;
	}

	const props: Record<string, string> = {};
	for (const line of (await readFile(file, 'utf8')).split(/\r?\n/)) {
		const m = line.match(pkgPropRegExp);
		if (m) {
			props[m[1]] = m[2];
		}
	}
	return props;
}
