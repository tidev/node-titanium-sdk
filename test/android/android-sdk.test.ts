import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { config, resetConfig } from '../../src/config.js';
import { detect, AndroidSDK } from '../../src/android/android-sdk.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cmd = process.platform === 'win32' ? '.cmd' : '';

describe('Android SDK', () => {
	afterEach(() => resetConfig());

	describe('load()', () => {
		it('should error if directory is invalid', async () => {
			await expect(AndroidSDK.load(undefined as any))
				.rejects.toThrowError(new TypeError('Expected Android SDK path to be a valid string'));
		});
	});
});
