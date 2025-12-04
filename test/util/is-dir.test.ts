import { describe, it, expect } from 'vitest';
import { isDir } from '../../src/util/is-dir.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('isDir()', () => {
	it('should return true if the path is a directory', () => {
		expect(isDir(__dirname)).toBe(true);
	});

	it('should return false if the path doesn\'t exist', () => {
		expect(isDir(join(__dirname, 'does_not_exist'))).toBe(false);
	});

	it('should return false if the path is not a directory', () => {
		expect(isDir(__filename)).toBe(false);
	});
});
