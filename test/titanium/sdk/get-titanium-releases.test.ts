import { describe, expect, it } from 'vitest';
import { getTitaniumReleases } from '../../../src/titanium/get-titanium-releases.js';

describe('getTitaniumReleases()', () => {
	it('should return the list of releases', async () => {
		const releases = await getTitaniumReleases();
		expect(releases).toBeDefined();
	});
});
