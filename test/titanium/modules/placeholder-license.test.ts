import { isPlaceholderLicense } from '../../../src/titanium/index.js';
import { describe, expect, it } from 'vitest';

describe('isPlaceholderLicense()', () => {
	it('recognises the scaffolding default', () => {
		expect(isPlaceholderLicense('Specify your license')).toBe(true);
	});

	it('ignores case and surrounding whitespace', () => {
		// The templates emit it with a trailing newline, and manifests are
		// hand-edited, so neither is a reliable shape.
		expect(isPlaceholderLicense('  specify your LICENSE  ')).toBe(true);
	});

	it('accepts a real licence', () => {
		for (const license of ['Apache-2.0', 'MIT', 'Apache Public License v2', 'Proprietary']) {
			expect(isPlaceholderLicense(license)).toBe(false);
		}
	});

	it('treats a missing licence as not a placeholder', () => {
		// Absent is a different problem from unfilled, and is not this check's.
		expect(isPlaceholderLicense(undefined)).toBe(false);
		expect(isPlaceholderLicense('')).toBe(false);
	});
});
