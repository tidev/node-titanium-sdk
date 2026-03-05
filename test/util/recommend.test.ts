import { recommend } from '../../src/util/recommend.js';
import { describe, expect, it } from 'vitest';

describe('recommend', () => {
	it('should recommend the best match', () => {
		expect(recommend('hello', ['world', 'hello', 'foo'])).toBe('hello');
	});

	it('should recommend mispelled word', () => {
		expect(recommend('helo', ['world', 'hello', 'foo'])).toBe('hello');
	});

	it('should recommend regardless of case', () => {
		expect(recommend('Hello', ['world', 'hello', 'foo'])).toBe('hello');
	});

	it('should recommend the best match with a prefix', () => {
		expect(recommend('help', ['world', 'hello', 'foo'])).toBe('hello');
	});
});
