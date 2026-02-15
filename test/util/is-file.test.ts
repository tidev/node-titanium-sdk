import { isFile } from '../../src/util/is-file.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('isFile()', () => {
	it('should return true if the path is a file', () => {
		expect(isFile(__filename)).toBe(true);
	});

	it("should return false if the path doesn't exist", () => {
		expect(isFile(join(__dirname, 'does_not_exist'))).toBe(false);
	});

	it('should return false if the path is not a file', () => {
		expect(isFile(__dirname)).toBe(false);
	});
});
