import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { config, resetConfig } from '../../../src/config.js';
import { detectTitaniumSDKs } from '../../../src/titanium/titanium-sdk.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exe = process.platform === 'win32' ? '.exe' : '';

describe('Titanium SDK', function() {
	afterEach(() => resetConfig());

	describe('detectTitaniumSDKs()', () => {
		it('should find Titanium SDKs', async () => {
			config.titanium.sdk.installPath[process.platform] = path.join(__dirname, 'mocks', 'mock-sdk');
			config.titanium.sdk.searchPaths[process.platform] = [];
			const { sdks, issues } = await detectTitaniumSDKs({
				bypassCache: true,
			});
			expect(sdks).toHaveLength(1);
			expect(sdks[0].manifest).toEqual({
				name: '0.0.0.GA',
				version: '0.0.0',
				moduleAPIVersion: {
					android: '4',
					iphone: '2'
				},
				timestamp: '1/1/2023 00:00',
				githash: '1234567890',
				platforms: ['android']
			});
			expect(sdks[0].name).toBe('0.0.0.GA');
			expect(sdks[0].path).toBe(config.titanium.sdk.installPath[process.platform]);
			expect(sdks[0].platforms).toEqual({
				android: {
					path: path.join(config.titanium.sdk.installPath[process.platform], 'android')
				}
			});
			expect(sdks[0].type).toBe('ga');
			expect(sdks[0].version).toBe('0.0.0');
			expect(issues).toHaveLength(0);

			const cached = await detectTitaniumSDKs();
			expect(cached.sdks).toEqual(sdks);
		});

		it('should return issues if no Titanium SDKs are found', async () => {
			config.titanium.sdk.installPath[process.platform] = path.join(__dirname, 'mocks', 'empty');
			config.titanium.sdk.searchPaths[process.platform] = [];
			const { sdks, issues } = await detectTitaniumSDKs({
				bypassCache: true,
			});
			expect(sdks).toHaveLength(0);
			expect(issues).toHaveLength(1);
			expect(issues[0].id).toBe('TITANIUM_SDK_NOT_FOUND');
			expect(issues[0].type).toBe('warning');
			expect(issues[0].details).toBe('No Titanium SDKs found. Please install the Titanium SDK and try again.');
		});
	});

	// describe('getTitaniumBuilds()', () => {
	// });
});
