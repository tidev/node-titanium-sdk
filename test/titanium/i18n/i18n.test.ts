import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as i18n from '../../../src/titanium/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('i18n', () => {
	it('load()', async () => {
		const result = await i18n.load(__dirname);
		expect(result).toBeInstanceOf(Object);
	});

	it('findLaunchScreens()', async () => {
		const result = await i18n.findLaunchScreens(__dirname, { bypassCache: true });
		expect(result).toBeInstanceOf(Array);
	});
});
