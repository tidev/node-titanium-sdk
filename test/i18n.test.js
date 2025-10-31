import { describe, it } from 'vitest';
import { i18n } from '../lib/i18n.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('i18n', () => {
	it('#load()', () => {
		const result = i18n.load(__dirname);
		expect(result).toBeInstanceOf(Object);
		// first language, places values into 'strings' property
		expect(result).toHaveProperty('en');
		expect(result.en).toHaveProperty('strings');
		expect(result.en.strings).toHaveProperty('whatever');
		expect(result.en.strings.whatever).toEqual('value');

		// second language, places app.xml values into 'app' property
		expect(result).toHaveProperty('es');
		expect(result.es).toHaveProperty('app');
		expect(result.es.app).toHaveProperty('whatever');
		expect(result.es.app.whatever).toEqual('my spanish value');
	});

	it('#findLaunchSreens()', () => {
		const results = i18n.findLaunchScreens(__dirname, console);

		expect(results).toBeInstanceOf(Array);
		expect(results.length).toEqual(1);
		expect(results).toEqual([
			path.join(__dirname, 'i18n', 'en', 'Default-568h@2x.png')
		]);
	});
});
