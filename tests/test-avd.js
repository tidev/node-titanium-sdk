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
const Emulator = require('../lib/emulator');
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
const emulator = new Emulator(config);

describe('emulator', function () {
	it('#detect() any', function (finished) {
		emulator.detect(function (err, avds) {
			console.log(avds);
			finished(err);
		});
	});

	it('#detect() type: avd', function (finished) {
		emulator.detect({ type: 'avd' }, function (err, avds) {
			console.log(avds);
			finished(err);
		});
	});

	it('#detect() type: genymotion', function (finished) {
		emulator.detect({ type: 'genymotion' }, function (err, avds) {
			console.log(avds);
			finished(err);
		});
	});

	function testDetectGenymotion2() {
		require('../lib/emulators/genymotion').detect(config, {}, function (err, results) {
			if (err) {
				console.error('ERROR! ' + err);
			} else {
				console.log(results);
			}
		});
	}

	it('#isRunning()', function (finished) {
		emulator.isRunning(name, function (err, emu) {
			if (err) {
				console.error('ERROR! ' + err + '\n');
			} else {
				if (emu) {
					console.log('Emulator "' + name + '" is running!\n');
					console.log(emu);
				} else {
					console.log('Emulator "' + name + '" is not running');
				}
				console.log();
			}
			finished(err);
		});
	});

	it('#isEmulator()', function (finished) {
		const name = 'emulator-5554';
		emulator.isEmulator(name, function (err, emu) {
			if (err) {
				console.error('ERROR! ' + err + '\n');
			} else {
				console.log(name, !!emu);
				console.log(emu);
				console.log();
			}
			finished(err);
		});
	});

	it('#start()', function (finished) {
		const name = 'emulator-5554';
		emulator.start(name, function (err, emulator) {
			if (err) {
				console.error(err + '\n');
			} else {
				console.log('emulator booting\n');

				emulator.on('booted', function (device) {
					console.log('booted!\n');
					console.log(device);
					console.log('\n');
				});

				emulator.on('ready', function (device) {
					console.log('ready!\n');
					console.log(device);
					console.log('\n');
					finished();
				});

				emulator.on('timeout', function () {
					console.log('timeout!\n');
				});

				console.log(emulator);
				console.log();
			}
		});
	});

	it('#start()', function (finished) {
		const name = 'emulator-5554';
		emulator.stop(name, function (err) {
			if (err) {
				console.error(err + '\n');
			} else {
				console.log('emulator stopping\n');
			}
			finished(err);
		});
	});
});
