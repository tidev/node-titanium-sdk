import { suggest } from '../../src/util/suggest.js';
import { describe, expect, it } from 'vitest';

describe('suggest', () => {
	it('should recommend the best match', () => {
		expect(suggest('hello', ['world', 'hello', 'foo'])).toBe('hello');
	});

	it('should recommend mispelled word', () => {
		expect(suggest('helo', ['world', 'hello', 'foo'])).toBe('hello');
	});

	it('should recommend regardless of case', () => {
		expect(suggest('Hello', ['world', 'hello', 'foo'])).toBe('hello');
	});

	it('should recommend the best match with a prefix', () => {
		expect(suggest('help', ['world', 'hello', 'foo'])).toBe('hello');
	});
});
