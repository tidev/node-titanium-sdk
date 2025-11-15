import fs from 'node:fs';
import path from 'node:path';

let manifestJsonCache = {};

/**
 * Attempts to locate and load the current module's manifest.json.
 * @param {Object} dir - The directory to start searching for the manifest.json file
 * @returns {Object} The manifest.json properties
 */
export function loadManifestJson(dir) {
	if (manifestJsonCache) {
		return manifestJsonCache;
	}

	const { root } = path.parse(dir);
	let currentDir = dir;

	while (currentDir !== root) {
		const file = path.join(currentDir, 'manifest.json');
		if (fs.existsSync(file)) {
			manifestJsonCache = JSON.parse(fs.readFileSync(file, 'utf8'));
			return manifestJsonCache;
		}
		currentDir = path.dirname(currentDir);
	}

	return null;
}
