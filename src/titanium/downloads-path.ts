import { config } from '../config.js';
import { expand } from '../util/expand.js';

/**
 * Returns the path to the downloads directory.
 * @returns The path to the downloads directory.
 */
export function getDownloadsPath(): string {
	return expand(config.titanium.downloadsDir);
}
