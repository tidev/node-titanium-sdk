import { describe, expect, it } from 'vitest';
import { getTitaniumBranchBuilds } from '../../../src/titanium/get-titanium-branch-builds.js';

describe('getTitaniumBranchBuilds()', () => {
	it('should return the list of builds', async () => {
		const builds = await getTitaniumBranchBuilds('master', process.platform);
		expect(builds).toBeDefined();
	});
});
