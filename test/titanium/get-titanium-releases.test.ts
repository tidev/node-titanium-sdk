import { getTitaniumReleases } from '../../src/titanium/index.js';
import { describe, expect, it } from 'vitest';

describe('getTitaniumReleases()', () => {
	it('should return the list of releases', async () => {
		const releases = await getTitaniumReleases();
		expect(releases).toBeDefined();
		const release = releases.find((release) => release.name === '13.1.1.GA');
		expect(release).toEqual({
			name: '13.1.1.GA',
			version: '13.1.1',
			date: '2026-01-29T13:36:18Z',
			url: 'https://github.com/tidev/titanium-sdk/releases/tag/13_1_1_GA',
			assets: [
				{
					os: 'linux',
					size: 100889320,
					url: 'https://github.com/tidev/titanium-sdk/releases/download/13_1_1_GA/mobilesdk-13.1.1.GA-linux.zip',
				},
				{
					os: 'osx',
					size: 170457154,
					url: 'https://github.com/tidev/titanium-sdk/releases/download/13_1_1_GA/mobilesdk-13.1.1.GA-osx.zip',
				},
				{
					os: 'win32',
					size: 100889320,
					url: 'https://github.com/tidev/titanium-sdk/releases/download/13_1_1_GA/mobilesdk-13.1.1.GA-win32.zip',
				},
			],
			type: 'ga',
		})
	});
});
