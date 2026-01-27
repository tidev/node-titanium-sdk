import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as i18n from '../../../src/titanium/i18n.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('i18n', () => {
	describe('load()', () => {
		it('should load the i18n data', async () => {
			const result = await i18n.load(join(__dirname, 'mocks', 'good'));
			expect(result).toEqual({
				en: {
					strings: {
						whatever: 'value',
					},
				},
				es: {
					app: {
						whatever: 'my spanish value',
					},
				},
			});
		});

		it('should return no data if the directory does not exist', async () => {
			const result = await i18n.load(join(__dirname, 'mocks', 'does-not-exist'));
			expect(result).toEqual({});
		});

		it('should return no data if directory is empty', async () => {
			let result = await i18n.load(join(__dirname, 'mocks', 'empty'));
			expect(result).toEqual({});

			result = await i18n.load(join(__dirname, 'mocks', 'empty2'));
			expect(result).toEqual({});
		});
	});

	describe('findLaunchScreens()', () => {
		it('should find the launch screens', async () => {
			const result = await i18n.findLaunchScreens(join(__dirname, 'mocks', 'good'), { bypassCache: true });
			expect(result).toEqual([
				join(__dirname, 'mocks', 'good', 'i18n', 'en', 'Default-568h@2x.png'),
			]);

			const result2 = await i18n.findLaunchScreens(join(__dirname, 'mocks', 'good'));
			expect(result2).toBe(result);
		});

		it('should return no launch screens if the directory does not exist', async () => {
			const result = await i18n.findLaunchScreens(join(__dirname, 'mocks', 'does-not-exist'), { bypassCache: true });
			expect(result).toEqual([]);
		});

		it('should return no launch screens if the directory is empty', async () => {
			let result = await i18n.findLaunchScreens(join(__dirname, 'mocks', 'empty'), { bypassCache: true });
			expect(result).toEqual([]);

			result = await i18n.findLaunchScreens(join(__dirname, 'mocks', 'empty2'), { bypassCache: true });
			expect(result).toEqual([]);
		});
	});
});
