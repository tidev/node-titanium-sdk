import { timeDiff } from '../../src/util/time-diff.js';
import { describe, expect, it } from 'vitest';

describe('timeDiff()', () => {
	it('should render the time difference between two dates', () => {
		const start = new Date('2025-01-01T00:00:00Z');
		const end = new Date('2025-01-02T00:00:00Z');
		expect(timeDiff(start, end)).toBe('1d');
	});

	it('should render the time difference between two dates with hours', () => {
		const start = new Date('2025-01-01T00:00:00Z');
		const end = new Date('2025-01-01T01:00:00Z');
		expect(timeDiff(start, end)).toBe('1h');
	});

	it('should render the time difference between two dates with minutes', () => {
		const start = new Date('2025-01-01T00:00:00Z');
		const end = new Date('2025-01-01T00:01:00Z');
		expect(timeDiff(start, end)).toBe('1m');
	});

	it('should render the time difference between two dates with seconds', () => {
		const start = new Date('2025-01-01T00:00:00Z');
		const end = new Date('2025-01-01T00:00:01Z');
		expect(timeDiff(start, end)).toBe('1s');
	});

	it('should render the time difference between two dates with milliseconds', () => {
		const start = new Date('2025-01-01T00:00:00Z');
		const end = new Date('2025-01-01T00:00:00.001Z');
		expect(timeDiff(start, end)).toBe('1ms');
	});

	it('should render the time difference between two dates with multiple units', () => {
		const start = new Date('2025-01-01T00:00:00Z');
		const end = new Date('2025-01-01T01:01:01.001Z');
		expect(timeDiff(start, end)).toBe('1h 1m 1s 1ms');
	});

	it('should handle no time difference', () => {
		const start = new Date('2025-01-01T00:00:00Z');
		const end = new Date('2025-01-01T00:00:00Z');
		expect(timeDiff(start, end)).toBe('0ms');
	});
});
