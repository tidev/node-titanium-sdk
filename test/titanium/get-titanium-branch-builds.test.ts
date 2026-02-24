import { getTitaniumBranchBuilds } from '../../src/titanium/index.js';
import { describe, expect, it } from 'vitest';

describe('getTitaniumBranchBuilds()', () => {
	it('should return the list of builds', async () => {
		const builds = await getTitaniumBranchBuilds('13_1_X', process.platform);
		expect(builds).toBeDefined();
		const build = builds[0];
		expect(build.name).toMatch(/^13\.1./);
		expect(build.version).toMatch(/^13\.1./);
		expect(build.date).toBeDefined();
		expect(build.expires).toBeDefined();
		expect(build.url.startsWith('https://github.com/tidev/titanium-sdk/actions/runs/')).toBe(true);
		expect(build.assets).toBeDefined();
		expect(build.assets.length).toBeGreaterThan(0);
		expect(build.assets.map((asset) => asset.os).sort()).toEqual(['linux', 'osx', 'win32']);
		expect(build.assets.every((asset) => asset.url !== undefined)).toBe(true);
		expect(build.assets.every((asset) => asset.size > 0)).toBe(true);
	});
});
