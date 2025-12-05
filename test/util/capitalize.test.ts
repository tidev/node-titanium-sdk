import { describe, expect, it } from 'vitest';
import { capitalize } from '../../src/util/capitalize.js';

describe('capitalize', () => {
	it('should capitalize the first letter of the string', () => {
		expect(capitalize('hello')).toBe('Hello');
	});

	it('should return an empty string if the input is an empty string', () => {
		expect(capitalize('')).toBe('');
	});

	it('should return the same string if the input is already capitalized', () => {
		expect(capitalize('Hello')).toBe('Hello');
		expect(capitalize('HELLO')).toBe('HELLO');
	});
});
