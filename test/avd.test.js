import { describe, it } from 'vitest';
import { Emulator } from '../lib/emulator.js';
import { android } from '../lib/android.js';

function MockConfig() {
	this.get = function (_s, d) {
		return d;
	};
}

android.setAndroidPackageJson({
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
const emulator = new Emulator(config);

describe('emulator', () => {
	it('#detect() any', (finished) => {
		emulator.detect((err, avds) => {
			expect(avds).toBeInstanceOf(Array);
			finished(err);
		});
	});

	it('#detect() type: avd', (finished) => {
		emulator.detect({ type: 'avd' }, (err, avds) => {
			expect(avds).toBeInstanceOf(Array);
			finished(err);
		});
	});

	describe('lifecycle', () => {
		let avd;

		before((finished) => {
			emulator.detect((err, avds) => {
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

		it('#isRunning() returns null object when not running', (finished) => {
			emulator.isRunning(avd.id, (err, emu) => {
				expect(emu).toBeTruthy();

				finished(err);
			});
		});

		// FIXME: This test isn't right. I think it will only pass when the emulator is running and we pass in the id (that has port in the value)?
		// it('#isEmulator() returns matching emulator?', (finished) => {
		// 	emulator.isEmulator(avd.name, (err, emu) => {
		// 		expect(emu).toBeTruthy();
		// 		finished(err);
		// 	});
		// });

		it('#start(), #isRunning() and #stop()', (finished) => {
			this.slow(30000);
			this.timeout(280000);

			emulator.start(avd.id, (err, emu) => {
				if (err) {
					return finished(err);
				}

				expect(emu).toBeTruthy();

				emu.on('ready', (device) => {
					expect(device).toBeTruthy();

					emulator.isRunning(device.emulator.id, (_err, emu) => {
						expect(emu).toBeTruthy();

						emulator.stop(device.emulator.id, (errOrCode) => {
							expect(errOrCode).toEqual(0);
							setTimeout(finished, 6000); // let it wait 5 seconds or else adb will still report it as connected
						});
					});
				});

				emu.on('timeout', () => {
					finished(new Error('emulator.start() timed out'));
				});
			});
		});
	});
});
