import { beforeAll, describe, expect, it } from 'vitest';
import { EmulatorManager } from '../lib/emulator.js';
import { setAndroidPackageJson } from '../lib/android.js';

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
const emulator = new EmulatorManager(config);

describe('emulator', () => {
	it('#detect() any', async () => {
		const avds = await emulator.detect();
		expect(avds).toBeInstanceOf(Array);
	});

	it('#detect() type: avd', async () => {
		const avds = await emulator.detect({ type: 'avd' });
		expect(avds).toBeInstanceOf(Array);
	});

	describe('lifecycle', () => {
		let avd;

		beforeAll(async () => {
			const avds = await emulator.detect();
			if (avds.length === 0) {
				throw new Error('Tests require at least one emulator defined!');
			}
			avd = avds[0];
		});

		it('#isRunning() returns null object when not running', async () => {
			const emu = await emulator.isRunning(avd.id);
			expect(emu).toBeTruthy();
		});

		// FIXME: This test isn't right. I think it will only pass when the emulator is running and we pass in the id (that has port in the value)?
		// it('#isEmulator() returns matching emulator?', async () => {
		// 	const emu = await emulator.isEmulator(avd.name);
		// 	expect(emu).toBeTruthy();
		// });

		it('#start(), #isRunning() and #stop()', async () => {
			const emu = await emulator.start(avd.id);
			expect(emu).toBeTruthy();

			await new Promise((resolve, reject) => {
				emu.on('ready', async (device) => {
					expect(device).toBeTruthy();

					const emu = await emulator.isRunning(device.emulator.id);
					expect(emu).toBeTruthy();

					await emulator.stop(device.emulator.id);
					setTimeout(() => resolve(), 6000); // let it wait 5 seconds or else adb will still report it as connected
				});

				emu.on('timeout', () => reject(new Error('emulator.start() timed out')));
			});
		}, 30000);
	});
});
