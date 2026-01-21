import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { config, resetConfig } from '../../src/config.js';
import { detect, AndroidNDK } from '../../src/android/android-ndk.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cmd = process.platform === 'win32' ? '.cmd' : '';

describe('Android NDK', () => {
	afterEach(() => resetConfig());

	describe('load()', () => {
		it('should error if directory is invalid', async () => {
			await expect(AndroidNDK.load(undefined as any))
				.rejects.toThrowError(new TypeError('Expected Android NDK path to be a valid string'));
			await expect(AndroidNDK.load(123 as any))
				.rejects.toThrowError(new TypeError('Expected Android NDK path to be a valid string'));
			await expect(AndroidNDK.load(''))
				.rejects.toThrowError(new TypeError('Expected Android NDK path to be a valid string'));
		});

		it('should error if directory does not exist', async () => {
			await expect(AndroidNDK.load(join(__dirname, 'doesnotexist')))
				.rejects.toThrowError(new Error('Android NDK path does not exist: ${path}'));
		});

		it('should error if directory is missing the "build" directory', async () => {
			await expect(AndroidNDK.load(join(__dirname, 'mocks', 'ndk', 'all', 'no-build-dir')))
				.rejects.toThrowError(new Error('Directory does not contain the "build" directory'));
		});

		it('should error if directory is missing the "platforms" directory', async () => {
			await expect(AndroidNDK.load(join(__dirname, 'mocks', 'ndk', 'all', 'no-platforms-dir')))
				.rejects.toThrowError(new Error('Directory does not contain the "platforms" directory'));
		});

		it('should error if directory is missing the "ndk-build" executable', async () => {
			await expect(AndroidNDK.load(join(__dirname, 'mocks', 'ndk', 'all', 'no-ndk-build')))
				.rejects.toThrowError(new Error('Directory does not contain the "ndk-build" executable'));
		});

		it('should error if directory is missing the "ndk-which" executable', async () => {
			await expect(AndroidNDK.load(join(__dirname, 'mocks', 'ndk', process.platform, 'no-ndk-which')))
				.rejects.toThrowError(new Error('Directory does not contain the "ndk-which" executable'));
		});

		it('should detect an NDK with no version', async () => {
			const dir = join(__dirname, 'mocks', 'ndk', process.platform, 'no-version');
			const ndk = await AndroidNDK.load(dir);
			expect(ndk).toEqual({
				path: dir,
				name: 'no-version',
				version: null,
				arch: '64-bit',
				executables: {
					'ndk-build': join(dir, `ndk-build${cmd}`),
					'ndk-which': join(dir, `ndk-which${cmd}`)
				},
			});
		});

		it('should detect an NDK r9 64-bit release', async () => {
			const dir = join(__dirname, 'mocks', 'ndk', process.platform, 'r9d-64bit');
			const ndk = await AndroidNDK.load(dir);
			expect(ndk).toEqual({
				path: dir,
				name: 'r9d',
				version: '9.3',
				arch: '64-bit',
				executables: {
					'ndk-build': join(dir, `ndk-build${cmd}`),
					'ndk-which': join(dir, `ndk-which${cmd}`)
				}
			});
		});

		it('should detect an NDK r9d 32-bit release', async () => {
			const dir = join(__dirname, 'mocks', 'ndk', process.platform, 'r9d-32bit');
			const ndk = await AndroidNDK.load(dir);
			expect(ndk).toEqual({
				path: dir,
				name: 'r9d',
				version: '9.3',
				arch: '32-bit',
				executables: {
					'ndk-build': join(dir, `ndk-build${cmd}`),
					'ndk-which': join(dir, `ndk-which${cmd}`)
				}
			});
		});

		it('should detect an NDK r11b 64-bit release', async () => {
			const dir = join(__dirname, 'mocks', 'ndk', process.platform, 'r11b-64bit');
			const ndk = await AndroidNDK.load(dir);
			expect(ndk).toEqual({
				path: dir,
				name: 'r11b',
				version: '11.1.2683735',
				arch: '64-bit',
				executables: {
					'ndk-build': join(dir, `ndk-build${cmd}`),
					'ndk-which': join(dir, `ndk-which${cmd}`)
				}
			});
		});

		it('should detect an NDK r11b 32-bit release', async () => {
			const dir = join(__dirname, 'mocks', 'ndk', process.platform, 'r11b-32bit');
			const ndk = await AndroidNDK.load(dir);
			expect(ndk).toEqual({
				path: dir,
				name: 'r11b',
				version: '11.1.2683735',
				arch: '32-bit',
				executables: {
					'ndk-build': join(dir, `ndk-build${cmd}`),
					'ndk-which': join(dir, `ndk-which${cmd}`)
				}
			});
		});

		it('should detect an NDK r29', async () => {
			const dir = join(__dirname, 'mocks', 'ndk', process.platform, 'r29');
			const ndk = await AndroidNDK.load(dir);
			expect(ndk).toEqual({
				path: dir,
				name: 'r29',
				version: '29.0.14206865',
				arch: '64-bit',
				executables: {
					'ndk-build': join(dir, `ndk-build${cmd}`),
					'ndk-which': join(dir, `ndk-which${cmd}`)
				}
			});
		});
	});

	describe('detect()', () => {
		it('should find Android NDKs', async () => {
			const dir = join(__dirname, 'mocks', 'ndk', process.platform, 'r29');
			config.android.ndk.searchPaths[process.platform] = [];
			const { ndks } = await detect({
				bypassCache: true,
				searchPaths: [
					dir,
				],
			});
			expect(ndks).toHaveLength(1);
			expect(ndks[0]).toEqual({
				arch: '64-bit',
				executables: {
					'ndk-build': join(dir, `ndk-build${cmd}`),
					'ndk-which': join(dir, `ndk-which${cmd}`)
				},
				name: 'r29',
				path: dir,
				version: '29.0.14206865',
			});
		});

		it('should cache Android NDKs', async () => {
			const dir = join(__dirname, 'mocks', 'ndk', process.platform, 'r29');
			config.android.ndk.searchPaths[process.platform] = [dir];
			const results1 = await detect({ bypassCache: true });
			const results2 = await detect();
			expect(results1).toBe(results2);
		});

		it('should return issues if no Android NDKs are found', async () => {
			config.android.ndk.searchPaths[process.platform] = ['does_not_exist'];
			const { ndks, issues } = await detect({ bypassCache: true });
			expect(ndks).toEqual([]);
			expect(issues.length).toBe(1);
			expect(issues[0].id).toBe('ANDROID_NDK_NOT_FOUND');
			expect(issues[0].type).toBe('warning');
		});

		it('should return issues if no valid Android NDKs are found', async () => {
			delete process.env.JAVA_HOME;
			config.android.ndk.searchPaths[process.platform] = [
				join(__dirname, 'mocks', 'ndk', process.platform, 'no-ndk-build'),
			];
			const { ndks, issues } = await detect({ bypassCache: true });
			expect(ndks).toEqual([]);
			expect(issues.length).toBe(1);
			expect(issues[0].id).toBe('ANDROID_NDK_NOT_FOUND');
			expect(issues[0].type).toBe('warning');
		});
	});
});
