import { describe, expect, it } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { tailgate } from '../../src/util/tailgate.js';

describe('tailgate()', () => {
	it('should queue up multiple calls', async () => {
		let count = 0;
		const fn = () => tailgate('foo', () => ++count);
		const results = await Promise.all([fn(), fn(), fn()]);
		expect(count).to.equal(3);
		expect(results).to.deep.equal([1, 2, 3]);
	});

	it('should queue up multiple async calls', async () => {
		let count = 0;
		const fn = () =>
		tailgate('foo', async () => {
			await delay(50);
			return ++count;
		});
		const results = await Promise.all([fn(), fn(), fn()]);
		expect(count).to.equal(1);
		expect(results).to.deep.equal([1, 1, 1]);
	});

	it('should catch errors', async () => {
		await expect(tailgate('foo', () => {
			throw new Error('oh snap');
		})).rejects.toThrow(/oh snap/);
	});
});
