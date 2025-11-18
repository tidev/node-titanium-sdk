import { describe, it, expect } from 'vitest';
import { detect as detectAndroid, setAndroidPackageJson } from '../lib/android.js';

function MockConfig() {
	this.get = (_s, d) => d;
}

setAndroidPackageJson({
	vendorDependencies: {
		'android sdk': '>=23.x <=27.x',
		'android build tools': '>=25.x <=27.x',
		'android platform tools': '27.x',
		'android tools': '<=26.x',
		'android ndk': '>=r11c <=r16c',
		node: '>=4.0 <=8.x',
		java: '>=1.8.x'
	},
});
const config = new MockConfig();

describe('android', () => {
	it('should detect Android environment', async () => {
		const info = await detectAndroid(config);
		console.log(info);
	});
});
