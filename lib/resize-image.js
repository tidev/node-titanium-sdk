import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

/**
 * Takes a source image and resizes it to one or more images.
 *
 * @param {String} src - The path to the source image being resized.
 * @param {Array|Object} dest - One or more destination objects consisting of the dest `file`, `width`, and `height`.
 * @param {Object} [logger] - A logger object containing a `trace()` function.
 */
export async function resizeImage(src, dest, logger) {
	if (!src) {
		throw new Error('Missing source');
	}
	if (!fs.existsSync(src)) {
		throw new Error('Source "' + src + '" does not exist');
	}
	if (!dest) {
		throw new Error('Missing dest');
	}

	if (!Array.isArray(dest)) {
		dest = [ dest ];
	}

	const cmd = [
		`java -jar "${path.resolve(module.filename, '..', '..', 'tools', 'resizer', 'resizer.jar')}"`,
		`"${src}"`
	];

	for (const d of dest) {
		if (!d || typeof d !== 'object') {
			throw new Error('Invalid destination');
		}
		if (!d.file) {
			throw new Error('Missing destination file');
		}

		const w = d.width | 0;
		const h = d.height | 0;

		if (!w && !h) {
			throw new Error('Missing destination width and height');
		} else if (w && !h) {
			h = w;
		} else if (!w && h) {
			w = h;
		}

		cmd.push(`"${d.file}"`);
		cmd.push(w);
		cmd.push(h);
	}

	cmd = cmd.join(' ');
	logger?.trace(`Resizing images: ${cmd}`);

	const { status } = spawnSync(cmd);
	if (status !== 0) {
		throw new Error('Failed to resize image: ' + cmd);
	}
}

