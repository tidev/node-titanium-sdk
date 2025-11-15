import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Emulator } from '../lib/emulator.js';
import { setAndroidPackageJson } from '../lib/android.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADB } from '../lib/adb.js';
import { setTimeout as delay } from 'node:timers/promises';
import { rimraf } from 'rimraf';

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
	this.get = (_s, d) => d;
}

const config = new MockConfig();
const adb = new ADB(config);
const emulator = new Emulator(config);

describe('adb', () => {
	it('#version() returns a valid semver string', async () => {
		const ver = await adb.version();
		expect(ver).toMatch(/^1\.0\.\d+/);
		expect(semver.valid(ver)).not.toBeNull();
	});

	// TODO: Add test where we start an emulator first, get it in listing, then stop it?
	it('#devices() returns empty Array when no emulators running', async () => {
		const devices = await adb.devices();
		expect(devices).toBeInstanceOf(Array);
	});

	// TODO: Start an emulator, make sure we get event?
	it('#trackDevices()', () => new Promise((resolve, reject) => {
		const connection = adb.trackDevices((err, devices) => {
			connection.end();
			if (err) {
				return reject(err);
			}
			// console.log('trackDevicesCallback: ' + JSON.stringify(devices));
			expect(devices).toBeInstanceOf(Array);
			resolve();
		});
	}));

	describe('with an emulator running', () => {
		let avd;
		let device;

		beforeAll(async () => {
			const avds = await emulator.detect();
			if (avds.length === 0) {
				throw new Error('Tests require at least one emulator defined!');
			}
			avd = avds[0];

			const emu = await emulator.start(avd.id);
			await new Promise((resolve, reject) => {
				emu.on('ready', (d) => {
					device = d;
					resolve();
				});

				emu.on('timeout', () => reject(new Error('emulator.start() timed out')));
			});
		}, 30000);

		afterAll(async () => {
			// Just call finished if there is no device, there may have been an issue when starting
			// the emulator in the before
			if (!device) {
				return;
			}
			await emulator.stop(device.emulator.id);
			await delay(5000); // let it wait 5 seconds or else adb will still report it as connected
		}, 30000);

		it('#shell()', async () => {
			const data = await adb.shell(device.id, 'cat /system/build.prop');
			// data is a Buffer!
			expect(data).toBeTruthy();
			// (typeof data).should.eql('Buffer');
		});

		it('#startApp(), #getPid() and #stopApp()', async () => {
			const appId = 'com.android.settings';
			const data = await adb.startApp(device.id, appId, 'wifi.WifiStatusTest');

			// data is a Buffer!
			expect(data).toBeTruthy(); // TODO: Test data.toString() holds particular text?

			const pid = await adb.getPid(device.id, appId);
			expect(err).toBeNull();

			expect(pid).toBeInstanceOf(Number);
			expect(pid).not.toEqual(0);

			await adb.stopApp(device.id, appId);
		}, 30000);

		it('#pull()', async () => {
			const dest = path.join(__dirname, 'hosts');
			expect(fs.existsSync(dest)).toBeFalsy();

			await adb.pull(device.id, '/system/etc/hosts', __dirname);

			// verify build.prop exists in current dir now!
			try {
				expect(fs.existsSync(dest)).toBeTruthy();
			} finally {
				try {
					rimraf(dest);
				} catch {
					// squash
				}
			}
		});

		it('#push()', async () => {
			const dest = '/mnt/sdcard/tmp/test-adb.js';

			// Ensure dest file doesn't exist
			await adb.shell(device.id, `rm -f '${dest}'`);

			// Then piush this file to dest
			await adb.push(device.id, __filename, dest);

			// verify it now exists and matches
			const data = await adb.shell(device.id, `cat '${dest}'`);

			// data is a Buffer!
			expect(data).toBeTruthy();
			// normalize newlines, android uses \r\n
			expect(data.toString().replace(/\r\n/g, '\n')).toEqual(fs.readFileSync(__filename).toString());
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
