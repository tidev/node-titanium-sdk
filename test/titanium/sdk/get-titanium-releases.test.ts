import { getTitaniumReleases } from '../../../src/titanium/get-titanium-releases.js';
import { describe, expect, it } from 'vitest';

describe('getTitaniumReleases()', () => {
	it('should return the list of releases', async () => {
		const releases = await getTitaniumReleases();
		expect(releases).toBeDefined();
	});
});
