import { getTitaniumBranches } from '../../../src/titanium/get-titanium-branches.js';
import { describe, expect, it } from 'vitest';

describe('getTitaniumBranches()', () => {
	it('should return the list of branches', async () => {
		const branches = await getTitaniumBranches();
		expect(branches).toBeDefined();
	});
});
