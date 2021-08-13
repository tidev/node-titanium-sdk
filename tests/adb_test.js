/* eslint no-unused-expressions: "off" */
'use strict';

function MockConfig() {
	this.get = function (s, d) {
		return d;
	};
}

const fs = require('fs');
const path = require('path');
const semver = require('semver');
const should = require('should'); // eslint-disable-line no-unused-vars
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

const ADB = require('../lib/adb');
const Emulator = require('../lib/emulator');

const config = new MockConfig();
const adb = new ADB(config);
const emulator = new Emulator(config);

describe('adb', function () {

	it('#version() returns a valid semver string', function (finished) {
		adb.version(function (err, ver) {
			if (err) {
				return finished(err);
			}
			ver.should.match(/^1\.0\.\d+/);
			should(semver.valid(ver)).not.be.null();
			finished();
		});
	});

	// TODO: Add test where we start an emulator first, get it in listing, then stop it?
	it('#devices() returns empty Array when no emulators running', function (finished) {
		adb.devices(function (err, devices) {
			if (err) {
				return finished(err);
			}
			devices.should.be.an.Array();
			finished();
		});
	});

	// TODO: Start an emulator, make sure we get event?
	it('#trackDevices()', function (finished) {
		let connection;
		function done(e) {
			connection.end();
			finished(e);
		}
		connection = adb.trackDevices(function (err, devices) {
			if (err) {
				return done(err);
			}
			// console.log('trackDevicesCallback: ' + JSON.stringify(devices));
			devices.should.be.an.Array();
			done();
		});
	});

	describe('with an emulator running', function () {
		let avd;
		let device;

		before(function (finished) {
			this.timeout(30000);

			emulator.detect(function (err, avds) {
				if (err) {
					return finished(err);
				}
				if (avds.length === 0) {
					return finished(new Error('Tests require at least one emulator defined!'));
				}
				avd = avds[0];

				emulator.start(avd.id, function (err, emu) {
					if (err) {
						return finished(err);
					}

					emu.on('ready', function (d) {
						device = d;
						finished();
					});

					emu.on('timeout', function () {
						finished(new Error('emulator.start() timed out'));
					});
				});
			});
		});

		after(function (finished) {
			this.timeout(35000);
			// Just call finished if there is no device, there may have been an issue when starting
			// the emulator in the before
			if (!device) {
				return finished();
			}
			emulator.stop(device.emulator.id, function (errOrCode) {
				errOrCode.should.eql(0);
				setTimeout(finished, 5000); // let it wait 5 seconds or else adb will still report it as connected
			});
		});

		it('#shell()', function (finished) {
			adb.shell(device.id, 'cat /system/build.prop', function (err, data) {
				if (err) {
					return finished(err);
				}

				// data is a Buffer!
				data.should.be.ok();
				// (typeof data).should.eql('Buffer');

				finished();
			});
		});

		it('#startApp(), #getPid() and #stopApp()', function (finished) {
			this.timeout(30000);

			const appId = 'com.android.settings';
			adb.startApp(device.id, appId, 'wifi.WifiStatusTest', function (err, data) {
				should(err).not.be.ok();

				// data is a Buffer!
				data.should.be.ok(); // TODO: Test data.toString() holds particular text?

				adb.getPid(device.id, appId, function (err, pid) {
					should(err).not.be.ok();

					pid.should.be.a.Number();
					pid.should.not.eql(0);

					adb.stopApp(device.id, appId, function (err) {
						should(err).not.be.ok();

						finished();
					});
				});
			});
		});

		it('#pull()', function (finished) {
			const dest = path.join(__dirname, 'hosts');
			fs.existsSync(dest).should.eql(false);

			adb.pull(device.id, '/system/etc/hosts', __dirname, function (err) {
				should(err).not.be.ok();

				// verify build.prop exists in current dir now!
				try {
					fs.existsSync(dest).should.eql(true);
				} finally {
					try {
						fs.unlinkSync(dest);
					} catch (_error) {
						// squash
					}
				}
				finished();
			});
		});

		it('#push()', function (finished) {
			const dest = '/mnt/sdcard/tmp/test-adb.js';

			// Ensure dest file doesn't exist
			adb.shell(device.id, 'rm -f ' + dest, function (err) {
				should(err).not.be.ok();

				// Then piush this file to dest
				adb.push(device.id, __filename, dest, function (err) {
					should(err).not.be.ok();

					// verify it now exists and matches
					adb.shell(device.id, 'cat ' + dest, function (err, data) {
						should(err).not.be.ok();

						// data is a Buffer!
						data.should.be.ok();
						// normalize newlines, android uses \r\n
						data.toString().replace(/\r\n/g, '\n').should.eql(fs.readFileSync(__filename).toString());

						finished();
					});
				});
			});
		});
	}); // with running emulator

	// TODO: Install a pre-built test app!
	// function testInstallApp() {
	// 	adb.installApp('emulator-5554', '~/appc/workspace/testapp2/build/android/bin/app.apk', function (err, data) {
	// 		if (err) {
	// 			console.error('ERROR! ' + err + '\n');
	// 		} else {
	// 			console.log('-----------------------------------------------------------------');
	// 			console.log(data);
	// 			console.log('<EOF>');
	// 		}
	// 	});
	// }
	//
	// function testForward() {
	// 	adb.forward('015d21d4ff181a17', 'tcp:5000', 'tcp:6000', function (err, data) {
	// 		if (err) {
	// 			console.error('ERROR! ' + err + '\n');
	// 		} else {
	// 			console.log('result = ' + data + '\n');
	// 		}
	// 	});
	// }
});
