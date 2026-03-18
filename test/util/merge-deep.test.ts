import { mergeDeep } from '../../src/util/merge-deep.js';
import { describe, it, expect } from 'vitest';

describe('mergeDeep', () => {
	it('should merge two objects', () => {
		const target = { a: 1, b: 2 };
		const source = { b: 3, c: 4 };
		const result = mergeDeep(target, source);
		expect(result).toEqual({ a: 1, b: 3, c: 4 });
	});

	it('should merge two objects with nested objects', () => {
		const target = { a: 1, b: { c: 2 } };
		const source = { b: { c: 3, d: 4 }, e: { f: 5 } };
		const result = mergeDeep(target, source);
		expect(result).toEqual({ a: 1, b: { c: 3, d: 4 }, e: { f: 5 } });
	});

	it('should merge two objects with nested objects and arrays', () => {
		const target = { a: 1, b: { c: 2, d: [1, 2] } };
		const source = { b: { c: 3, d: [3, 4] } };
		const result = mergeDeep(target, source);
		expect(result).toEqual({ a: 1, b: { c: 3, d: [3, 4] } });
	});

	it('should merge two objects with nested objects and arrays and overwrite the target', () => {
		const target = { a: 1, b: { c: 2, d: [1, 2] } };
		const source = { b: { c: 3, d: [3, 4], e: 5 } };
		const result = mergeDeep(target, source);
		expect(result).toEqual({ a: 1, b: { c: 3, d: [3, 4], e: 5 } });
	});
});
