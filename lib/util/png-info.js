/**
 * Reads in a PNG file and returns the height, width, and color depth.
 *
 * @param {Buffer} buf - A buffer containing the contents of a PNG file.
 *
 * @returns {Object} An object containing the image's height, width, and color depth.
 */
export function pngInfo(buf) {
	function u32(o) {
		return buf[o] << 24 | buf[o + 1] << 16 | buf[o + 2] << 8 | buf[o + 3];
	}

	return {
		width: u32(16),
		height: u32(16 + 4),
		alpha: !!(buf[25] & 4)
	};
}
