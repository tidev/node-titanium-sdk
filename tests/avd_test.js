/* eslint no-unused-expressions: "off" */
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
			avds.should.be.an.Array;
			finished(err);
		});
	});

	it('#detect() type: avd', function (finished) {
		emulator.detect({ type: 'avd' }, function (err, avds) {
			avds.should.be.an.Array;
			finished(err);
		});
	});

	it('#detect() type: genymotion', function (finished) {
		emulator.detect({ type: 'genymotion' }, function (err, avds) {
			avds.should.be.an.Array;
			finished(err);
		});
	});

	describe('lifecycle', function () {
		let avd;

		before(function (finished) {
			emulator.detect(function (err, avds) {
				if (err) {
					return finished(err);
				}
				if (avds.length === 0) {
					return finished(new Error('Tests require at least one emulator defined!'));
				}
				avd = avds[0];
				finished();
			});
		});

		it('#isRunning() returns null object when not running', function (finished) {
			emulator.isRunning(avd.id, function (err, emu) {
				should(emu).not.be.ok;

				finished(err);
			});
		});

		// FIXME: This test isn't right. I think it will only pass when the emulator is running and we pass in the id (that has port in the value)?
		// it('#isEmulator() returns matching emulator?', function (finished) {
		// 	emulator.isEmulator(avd.name, function (err, emu) {
		// 		emu.should.be.ok;
		// 		finished(err);
		// 	});
		// });

		it('#start(), #isRunning() and #stop()', function (finished) {
			this.slow(30000);
			this.timeout(90000);

			emulator.start(avd.id, function (err, emu) {
				if (err) {
					return finished(err);
				}

				emu.should.be.ok;

				emu.on('ready', function (device) {
					device.should.be.ok;

					emulator.isRunning(device.emulator.id, function (err, emu) {
						emu.should.be.ok;

						emulator.stop(device.emulator.id, function (errOrCode) {
							errOrCode.should.eql(0);
							finished(); // TODO wait 5 seconds here or else future start call that quickly follows will get messed up!. See adb_test
						});
					});
				});

				emu.on('timeout', function () {
					finished(new Error('emulator.start() timed out'));
				});
			});
		});
	});
});
