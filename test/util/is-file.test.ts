import { describe, it, expect } from 'vitest';
import { isFile } from '../../src/util/is-file.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('isFile()', () => {
	it('should return true if the path is a file', () => {
		expect(isFile(__filename)).toBe(true);
	});

	it('should return false if the path doesn\'t exist', () => {
		expect(isFile(join(__dirname, 'does_not_exist'))).toBe(false);
	});

	it('should return false if the path is not a file', () => {
		expect(isFile(__dirname)).toBe(false);
	});
});
