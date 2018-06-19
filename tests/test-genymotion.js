'use strict';

function MockConfig() {
	this.get = function (s, d) {
		if (s === 'genymotion.enabled') {
			return true;
		}
		return d;
	};
}

const should = require('should'); // eslint-disable-line no-unused-vars
const config = new MockConfig();
const genymotion = require('../lib/emulators/genymotion');
const android = require('../lib/android');
android.androidPackageJson({
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

describe('genymotion', function () {

	it('#detect()', function (finished) {
		genymotion.detect(config, {}, function (err, results) {
			if (err) {
				console.error('ERROR! ' + err);
			} else {
				console.log(results);
			}
			finished(err);
		});
	});
});
