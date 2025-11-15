import { describe, expect, it, before, after } from 'vitest';
import { Emulator } from '../lib/emulator.js';
import { setAndroidPackageJson } from '../lib/android.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADB } from '../lib/adb.js';
import { setTimeout as delay } from 'node:timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function MockConfig() {
	this.get = function (_s, d) {
		return d;
	};
}

const config = new MockConfig();
const adb = new ADB(config);
const emulator = new Emulator(config);

describe('adb', () => {
	it('#version() returns a valid semver string', (finished) => {
		adb.version((err, ver) => {
			if (err) {
				return finished(err);
			}
			expect(ver).toMatch(/^1\.0\.\d+/);
			expect(semver.valid(ver)).not.toBeNull();
			finished();
		});
	});

	// TODO: Add test where we start an emulator first, get it in listing, then stop it?
	it('#devices() returns empty Array when no emulators running', (finished) => {
		adb.devices((err, devices) => {
			if (err) {
				return finished(err);
			}
			expect(devices).toBeInstanceOf(Array);
			finished();
		});
	});

	// TODO: Start an emulator, make sure we get event?
	it('#trackDevices()', (finished) => {
		let connection;
		function done(e) {
			connection.end();
			finished(e);
		}
		connection = adb.trackDevices((err, devices) => {
			if (err) {
				return done(err);
			}
			// console.log('trackDevicesCallback: ' + JSON.stringify(devices));
			expect(devices).toBeInstanceOf(Array);
			done();
		});
	});

	describe('with an emulator running', () => {
		let avd;
		let device;

		before(async () => {
			this.timeout(30000);

			const avds = await emulator.detect();
			if (avds.length === 0) {
				return finished(new Error('Tests require at least one emulator defined!'));
			}
			avd = avds[0];

			emulator.start(avd.id, (err, emu) => {
				if (err) {
					return finished(err);
				}

				emu.on('ready', (d) => {
					device = d;
					finished();
				});

				emu.on('timeout', () => {
					finished(new Error('emulator.start() timed out'));
				});
			});
		});

		after(async () => {
			this.timeout(35000);
			// Just call finished if there is no device, there may have been an issue when starting
			// the emulator in the before
			if (!device) {
				return finished();
			}
			await emulator.stop(device.emulator.id);
			await delay(5000); // let it wait 5 seconds or else adb will still report it as connected
		});

		it('#shell()', (finished) => {
			adb.shell(device.id, 'cat /system/build.prop', (err, data) => {
				if (err) {
					return finished(err);
				}

				// data is a Buffer!
				expect(data).toBeTruthy();
				// (typeof data).should.eql('Buffer');

				finished();
			});
		});

		it('#startApp(), #getPid() and #stopApp()', (finished) => {
			this.timeout(30000);

			const appId = 'com.android.settings';
			adb.startApp(device.id, appId, 'wifi.WifiStatusTest', (err, data) => {
				expect(err).toBeNull();

				// data is a Buffer!
				expect(data).toBeTruthy(); // TODO: Test data.toString() holds particular text?

				adb.getPid(device.id, appId, (err, pid) => {
					expect(err).toBeNull();

					expect(pid).toBeInstanceOf(Number);
					expect(pid).not.toEqual(0);

					adb.stopApp(device.id, appId, (err) => {
						expect(err).toBeFalsy();

						finished();
					});
				});
			});
		});

		it('#pull()', (finished) => {
			const dest = path.join(__dirname, 'hosts');
			expect(fs.existsSync(dest)).toBeFalsy();

			adb.pull(device.id, '/system/etc/hosts', __dirname, (err) => {
				expect(err).toBeFalsy();

				// verify build.prop exists in current dir now!
				try {
					expect(fs.existsSync(dest)).toBeTruthy();
				} finally {
					try {
						fs.unlinkSync(dest);
					} catch {
						// squash
					}
				}
				finished();
			});
		});

		it('#push()', (finished) => {
			const dest = '/mnt/sdcard/tmp/test-adb.js';

			// Ensure dest file doesn't exist
			adb.shell(device.id, 'rm -f ' + dest, (err) => {
				expect(err).toBeFalsy();

				// Then piush this file to dest
				adb.push(device.id, __filename, dest, (err) => {
					expect(err).toBeFalsy();

					// verify it now exists and matches
					adb.shell(device.id, 'cat ' + dest, (err, data) => {
						expect(err).toBeFalsy();

						// data is a Buffer!
						expect(data).toBeTruthy();
						// normalize newlines, android uses \r\n
						expect(data.toString().replace(/\r\n/g, '\n')).toEqual(fs.readFileSync(__filename).toString());

						finished();
					});
				});
			});
		});
	}); // with running emulator

	// TODO: Install a pre-built test app!
	// function testInstallApp() {
	// 	adb.installApp('emulator-5554', '~/appc/workspace/testapp2/build/android/bin/app.apk', (err, data) => {
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
	// 	adb.forward('015d21d4ff181a17', 'tcp:5000', 'tcp:6000', (err, data) => {
	// 		if (err) {
	// 			console.error('ERROR! ' + err + '\n');
	// 		} else {
	// 			console.log('result = ' + data + '\n');
	// 		}
	// 	});
	// }
});
