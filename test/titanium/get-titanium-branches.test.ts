import { getTitaniumBranches } from '../../src/titanium/index.js';
import { describe, expect, it } from 'vitest';

describe('getTitaniumBranches()', () => {
	it('should return the list of branches', async () => {
		const branches = await getTitaniumBranches();
		expect(branches).toBeDefined();
		expect(branches.includes('main')).toBe(true);
		expect(branches.includes('13_1_X')).toBe(true);
	});
});
