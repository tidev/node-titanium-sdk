import { config, resetConfig } from '../../../src/config.js';
import { detectTitaniumSDKs } from '../../../src/titanium/index.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Titanium SDK', function () {
	afterEach(() => resetConfig());

	describe('detectTitaniumSDKs()', () => {
		it('should find Titanium SDKs', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'mock-sdk');
			config.titanium.sdk.searchPaths[process.platform] = [];
			const { sdks, issues } = await detectTitaniumSDKs();
			expect(Object.keys(sdks)).toHaveLength(1);

			const sdk = sdks['0.0.0.GA'];
			expect(sdk).toBeDefined();
			expect(sdk.manifest).toEqual({
				name: '0.0.0.GA',
				version: '0.0.0',
				moduleAPIVersion: {
					android: '4',
					iphone: '2',
				},
				timestamp: '1/1/2023 00:00',
				githash: '1234567890',
				platforms: ['android'],
			});
			expect(sdk.name).toBe('0.0.0.GA');
			expect(sdk.path).toBe(config.titanium.sdk.installPath[process.platform]);
			expect(sdk.platforms).toEqual({
				android: {
					path: join(config.titanium.sdk.installPath[process.platform], 'android'),
				},
			});
			expect(sdk.type).toBe('ga');
			expect(sdk.version).toBe('0.0.0');
			expect(issues).toHaveLength(0);

			const cached = await detectTitaniumSDKs();
			expect(cached.sdks).toEqual(sdks);
		});

		it('should find Titanium SDKs in Titanium install directory', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'install-dir');
			config.titanium.sdk.searchPaths[process.platform] = [];
			const { sdks, issues } = await detectTitaniumSDKs();
			expect(Object.keys(sdks)).toHaveLength(1);

			const os = process.platform === 'darwin' ? 'osx' : process.platform;

			const sdk = sdks['0.0.0.GA'];
			expect(sdk).toBeDefined();
			expect(sdk.manifest).toEqual({
				name: '0.0.0.GA',
				version: '0.0.0',
				moduleAPIVersion: {
					android: '4',
					iphone: '2',
				},
				timestamp: '1/1/2023 00:00',
				githash: '1234567890',
				platforms: ['android'],
			});
			expect(sdk.name).toBe('0.0.0.GA');
			expect(sdk.path).toBe(
				join(config.titanium.sdk.installPath[process.platform], 'mobilesdk', os, '0.0.0.GA')
			);
			expect(sdk.platforms).toEqual({
				android: {
					path: join(sdk.path, 'android'),
				},
			});
			expect(sdk.type).toBe('ga');
			expect(sdk.version).toBe('0.0.0');
			expect(issues).toHaveLength(0);
		});

		it('should find Titanium SDKs using search paths', async () => {
			const sdkDir = join(__dirname, 'mocks', 'mock-sdk');
			config.titanium.sdk.installPath[process.platform] = null;
			config.titanium.sdk.searchPaths[process.platform] = [];
			const { sdks, issues } = await detectTitaniumSDKs({
				searchPaths: [sdkDir],
			});
			expect(Object.keys(sdks)).toHaveLength(1);

			const sdk = sdks['0.0.0.GA'];
			expect(sdk).toBeDefined();
			expect(sdk.manifest).toEqual({
				name: '0.0.0.GA',
				version: '0.0.0',
				moduleAPIVersion: {
					android: '4',
					iphone: '2',
				},
				timestamp: '1/1/2023 00:00',
				githash: '1234567890',
				platforms: ['android'],
			});
			expect(sdk.name).toBe('0.0.0.GA');
			expect(sdk.path).toBe(sdkDir);
			expect(sdk.platforms).toEqual({
				android: {
					path: join(sdkDir, 'android'),
				},
			});
			expect(sdk.type).toBe('ga');
			expect(sdk.version).toBe('0.0.0');
			expect(issues).toHaveLength(0);
		});

		it('should find Titanium SDKs using config paths', async () => {
			const sdkDir = join(__dirname, 'mocks', 'mock-sdk');
			config.titanium.sdk.installPath[process.platform] = null;
			config.titanium.sdk.searchPaths[process.platform] = [sdkDir];
			const { sdks, issues } = await detectTitaniumSDKs();
			expect(Object.keys(sdks)).toHaveLength(1);

			const sdk = sdks['0.0.0.GA'];
			expect(sdk).toBeDefined();
			expect(sdk.manifest).toEqual({
				name: '0.0.0.GA',
				version: '0.0.0',
				moduleAPIVersion: {
					android: '4',
					iphone: '2',
				},
				timestamp: '1/1/2023 00:00',
				githash: '1234567890',
				platforms: ['android'],
			});
			expect(sdk.name).toBe('0.0.0.GA');
			expect(sdk.path).toBe(sdkDir);
			expect(sdk.platforms).toEqual({
				android: {
					path: join(sdkDir, 'android'),
				},
			});
			expect(sdk.type).toBe('ga');
			expect(sdk.version).toBe('0.0.0');
			expect(issues).toHaveLength(0);
		});

		it('should return issues if no Titanium SDKs are found', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'empty');
			config.titanium.sdk.searchPaths[process.platform] = [];
			const { sdks, issues } = await detectTitaniumSDKs();
			expect(Object.keys(sdks)).toHaveLength(0);
			expect(issues).toHaveLength(1);
			expect(issues[0].id).toBe('TITANIUM_SDK_NOT_FOUND');
			expect(issues[0].type).toBe('warning');
			expect(issues[0].details).toBe(
				'No Titanium SDKs found. Please install the Titanium SDK and try again.'
			);
		});

		it('should not load an SDK without a name', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'no-name-sdk');
			config.titanium.sdk.searchPaths[process.platform] = [];
			const { sdks, issues } = await detectTitaniumSDKs();
			expect(Object.keys(sdks)).toHaveLength(0);
			expect(issues).toHaveLength(1);
			expect(issues[0].id).toBe('TITANIUM_SDK_NOT_FOUND');
		});

		it('should find RC SDK', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'rc-release');
			config.titanium.sdk.searchPaths[process.platform] = [];
			const { sdks } = await detectTitaniumSDKs();
			expect(Object.keys(sdks)).toHaveLength(1);
			expect(sdks['0.0.0.RC']).toBeDefined();
			expect(sdks['0.0.0.RC'].type).toBe('rc');
		});

		it('should find Beta SDK', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'beta-release');
			config.titanium.sdk.searchPaths[process.platform] = [];
			const { sdks } = await detectTitaniumSDKs();
			expect(Object.keys(sdks)).toHaveLength(1);
			expect(sdks['0.0.0.beta']).toBeDefined();
			expect(sdks['0.0.0.beta'].type).toBe('beta');
		});

		it('should find CI Build SDK', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'ci-build');
			config.titanium.sdk.searchPaths[process.platform] = [];
			const { sdks } = await detectTitaniumSDKs();
			expect(Object.keys(sdks)).toHaveLength(1);
			expect(sdks['0.0.0.v20260226111717']).toBeDefined();
			expect(sdks['0.0.0.v20260226111717'].type).toBe('nightly');
		});
	});
});
