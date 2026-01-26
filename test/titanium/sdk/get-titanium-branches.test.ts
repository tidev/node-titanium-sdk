import { describe, expect, it } from 'vitest';
import { getTitaniumBranches } from '../../../src/titanium/get-titanium-branches.js';

describe('getTitaniumBranches()', () => {
	it('should return the list of branches', async () => {
		const branches = await getTitaniumBranches();
		expect(branches).toBeDefined();
	});
});
