import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { config, resetConfig } from '../../src/config.js';
import { detect, AndroidSDK } from '../../src/android/android-sdk.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exe = process.platform === 'win32' ? '.exe' : '';
const testPlatform = process.platform === 'win32' ? 'win32' : 'posix';

describe('Android SDK', () => {
	afterEach(() => resetConfig());

	describe('load()', () => {
		it('should error if directory is invalid', async () => {
			await expect(AndroidSDK.load(undefined as any))
				.rejects.toThrowError(new TypeError('Expected Android SDK path to be a valid string'));
			await expect(AndroidSDK.load(123 as any))
				.rejects.toThrowError(new TypeError('Expected Android SDK path to be a valid string'));
			await expect(AndroidSDK.load(''))
				.rejects.toThrowError(new TypeError('Expected Android SDK path to be a valid string'));
		});

		it('should error if directory does not exist', async () => {
			await expect(AndroidSDK.load(join(__dirname, 'doesnotexist')))
				.rejects.toThrowError(new Error(`Android SDK path does not exist: ${join(__dirname, 'doesnotexist')}`));
		});

		it('should error if missing adb executable', async () => {
			await expect(AndroidSDK.load(join(__dirname, 'mocks', 'sdk', testPlatform, 'missing-adb')))
				.rejects.toThrowError(new Error('Invalid Android SDK: missing required executable "adb"'));
		});

		it('should error if missing emulator executable', async () => {
			await expect(AndroidSDK.load(join(__dirname, 'mocks', 'sdk', testPlatform, 'missing-emulator')))
				.rejects.toThrowError(new Error('Invalid Android SDK: missing required executable "emulator"'));
		});

		it('should detect minimal sdk', async () => {
			const path = join(__dirname, 'mocks', 'sdk', testPlatform, 'minimal');
			const sdk = await AndroidSDK.load(path);
			expect(sdk.addons).to.deep.equal([]);
			expect(sdk.executables).to.deep.equal({
				adb: join(path, 'platform-tools', `adb${exe}`),
				emulator: join(path, 'emulator', `emulator${exe}`),
			});
			expect(sdk.path).to.equal(path);
			expect(sdk.platforms).to.deep.equal([]);
			expect(sdk.systemImages).to.deep.equal({});

			expect(sdk.issues).to.have.length(1);
			expect(sdk.issues[0].id).to.equal('ANDROID_SDK_NO_PLATFORMS');
		});

		it('should detect sdk with platforms and system images', async () => {
			const path = join(__dirname, 'mocks', 'sdk', testPlatform, 'with-platforms-and-system-images');
			const sdk = await AndroidSDK.load(path);
			expect(sdk.addons).to.deep.equal([]);
			expect(sdk.executables).to.deep.equal({
				adb: join(path, 'platform-tools', `adb${exe}`),
				emulator: join(path, 'emulator', `emulator${exe}`),
			});
			expect(sdk.path).to.equal(path);
			expect(sdk.platforms).to.deep.equal([
				{
					abis: {},
					androidJar: null,
					apiLevel: 36,
					codename: null,
					defaultSkin: 'WVGA800',
					minToolsRev: 22,
					name: 'Android 16',
					path: join(path, 'platforms', 'android-36'),
					revision: 1,
					sdk: 'android-36',
					skins: ['WVGA800'],
					version: '16'
				}
			]);
			expect(sdk.systemImages).to.deep.equal({
				'android-36.1/example/x86_64': {
					abi: 'x86_64',
					sdk: 'android-36.1',
					skins: [],
					type: 'example'
				}
			});

			expect(sdk.issues).to.have.length(0);
		});
	});

	describe('detect()', () => {
		it('should find Android SDKs', async () => {
			const path = join(__dirname, 'mocks', 'sdk', testPlatform, 'with-platforms-and-system-images');
			config.android.sdk.searchPaths[testPlatform] = [];
			const { sdks } = await detect({
				bypassCache: true,
				searchPaths: [path],
			});
			expect(sdks).toHaveLength(1);
			expect(sdks).toEqual([
				{
					addons: [],
					executables: {
						adb: join(path, 'platform-tools', `adb${exe}`),
						emulator: join(path, 'emulator', `emulator${exe}`),
					},
					issues: [],
					path,
					platforms: [
						{
							abis: {},
							androidJar: null,
							apiLevel: 36,
							codename: null,
							defaultSkin: 'WVGA800',
							minToolsRev: 22,
							name: 'Android 16',
							path: join(path, 'platforms', 'android-36'),
							revision: 1,
							sdk: 'android-36',
							skins: ['WVGA800'],
							version: '16'
						}
					],
					systemImages: {
						'android-36.1/example/x86_64': {
							abi: 'x86_64',
							sdk: 'android-36.1',
							skins: [],
							type: 'example'
						}
					}
				}
			]);
		});

		it('should cache Android SDKs', async () => {
			const dir = join(__dirname, 'mocks', 'sdk', testPlatform, 'r29');
			config.android.sdk.searchPaths[testPlatform] = [dir];
			const results1 = await detect({ bypassCache: true });
			const results2 = await detect();
			expect(results1).toBe(results2);
		});

		it('should return issues if no Android SDKs are found', async () => {
			config.android.sdk.searchPaths[testPlatform] = ['does_not_exist'];
			const { sdks, issues } = await detect({ bypassCache: true });
			expect(sdks).toEqual([]);
			expect(issues.length).toBe(1);
			expect(issues[0].id).toBe('ANDROID_SDK_NOT_FOUND');
			expect(issues[0].type).toBe('warning');
		});
	});
});
