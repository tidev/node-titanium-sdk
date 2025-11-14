import { detect as androidDetect } from './android.js';
import { ADB } from './adb.js';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Emulator extends EventEmitter {}

export class EmulatorManager {
	Emulator = Emulator;

	constructor(config) {
		this.config = config;
	}

	/**
	 * Loads emulator implementation modules and detects all available emulators.
	 * @param {Object} [opts] - Detection options
	 * @param {String} [opts.type] - The type of emulator to load (avd); defaults to all
	 * @param {Function} callback - A function to call when the detection has completed
	 */
	async detect(opts) {
		if (opts && typeof opts === 'function') {
			callback = opts;
			opts = {};
		}

		const files = opts && opts.type ? [ `${opts.type}.js` ] : fs.readdirSync(path.join(__dirname, 'emulators'));
		const re = /\.js$/;
		const { config } = this;

		const results = await Promise.all(files.map(async (filename) => {
			const file = path.join(__dirname, 'emulators', filename);
			if (re.test(filename) && fs.existsSync(file)) {
				const module = await import(file);
				if (typeof module.detect === 'function') {
					return module.detect(config, opts);
				}
			}
		}));

		const androidEnv = await androidDetect(this.config, opts);
		const ver2api = {};
		const emus = [];

		for (const id of Object.keys(androidEnv.targets)) {
			if (androidEnv.targets[id].type === 'platform') {
				ver2api[androidEnv.targets[id].version] = androidEnv.targets[id].sdk;
			}
		}

		for (const r of results) {
			if (r && Array.isArray(r.avds)) {
				for (const avd of r.avds) {
					if (!avd['api-level']) {
						avd['api-level'] = ver2api[avd['sdk-version']] || null;
					}
					if (!avd.id) {
						avd.id = avd.name;
					}
					emus.push(avd);
				}
			}
		}

		opts.logger?.trace(`Found ${emus.length} emulators`);
		return emus;
	}

	/**
	 * Detects if a specific Android emulator is running.
	 * @param {String} id - The id of the emulator
	 * @param {Object} [opts] - Detection options
	 * @param {String} [opts.type] - The type of emulator to load (avd); defaults to all
	 * @param {Function} callback - A function to call when the detection has completed
	 */
	isRunning(id, opts, callback) {
		if (opts && typeof opts === 'function') {
			callback = opts;
			opts = {};
		}

		opts.logger?.trace(`Detecting if ${id} exists...`);

		this.detect(opts, (err, emus) => {
			if (err) {
				return callback(err);
			}

			const emu = emus.filter(e => e && e.id == id).shift(); // eslint-disable-line eqeqeq

			if (!emu) {
				return callback(new Error(`Invalid emulator "${id}"`), null);
			}

			opts.logger?.trace('Emulator exists, detecting all running emulators and connected devices...');

			// need to see if the emulator is running
			const adb = new ADB(this.config);
			adb.devices((err, devices) => {
				if (err) {
					return callback(err);
				}

				opts.logger?.trace(`Detected ${devices.length} running emulators and connected devices`);

				// if there are no devices, then it can't possibly be running
				if (!devices.length) {
					return callback(null, null);
				}

				opts.logger?.trace(`Checking ${devices.length} devices to see if it's the emulator we want`);

				import(path.join(__dirname, 'emulators', emu.type + '.js')).then(({ isRunning }) => {
					isRunning(this.config, emu, devices, (err, device) => {
						if (err) {
							opts.logger?.trace(`Failed to check if the emulator was running: ${err}`);
						} else if (device) {
							opts.logger?.trace('The emulator is running');
						} else {
							opts.logger?.trace('The emulator is NOT running');
						}
						callback(err, device);
					});
				});
			});
		});
	}

	/**
	 * Determines if the specified "device name" is an emulator or a device.
	 * @param {String} device - The name of the device returned from 'adb devices'
	 * @param {Object} [opts] - Detection options
	 * @param {String} [opts.type] - The type of emulator to load (avd); defaults to all
	 * @param {Function} callback - A function to call when the detection has completed
	 */
	isEmulator(device, opts, callback) {
		if (opts && typeof opts === 'function') {
			callback = opts;
			opts = {};
		}

		const files = opts && opts.type ? [ opts.type + '.js' ] : fs.readdirSync(path.join(__dirname, 'emulators'));
		const re = /\.js$/;
		const { config } = this;

		Promise.all(files.map(async (filename) => {
			const file = path.join(__dirname, 'emulators', filename);
			if (re.test(filename) && fs.existsSync(file)) {
				const module = await import(file);
				if (typeof module.isEmulator === 'function') {
					return module.isEmulator(config, device);
				}
			}
		})).then(results => {
			callback(null, results.filter(n => n).shift());
		}).catch(_err => {
			callback(new Error(`Unable to find device "${device}"`));
		});
	}

	checkedBooted(config, opts, emulator) {
		// we need to get the id of emulator
		const adb = new ADB(config);
		const retryTimeout = 2000; // if an adb call fails, how long before we retry
		const bootTimeout = opts.bootTimeout || 240000; // 4 minutes to boot before timeout

		// if a timeout is set and the emulator doesn't boot quick enough, fire the timeout event,
		// however if the timeout is zero, still listen for the timeout to kill the whilst loop above
		const bootTimer = setTimeout(() => {
			opts.logger?.trace(`Timed out while waiting for the emulator to boot; waited ${bootTimeout} ms`);
			conn?.end();
			if (bootTimeout) {
				emulator.emit('timeout', { type: 'emulator', waited: bootTimeout });
			}
		}, bootTimeout);

		const sdcardTimeout = opts.sdcardTimeout || 60000; // 1 minute to boot before timeout
		let sdcardTimer = setTimeout(() => {
			if (sdcardTimeout) {
				emulator.emit('timeout', { type: 'sdcard', waited: sdcardTimeout });
			}
		}, sdcardTimeout);

		opts.logger?.trace(`Checking the boot state for the next ${bootTimeout} ms`);
		opts.logger?.trace('Waiting for emulator to register with ADB');

		conn = adb.trackDevices((err, devices) => {
			if (err) {
				opts.logger?.trace(`Error tracking devices: ${err.message}`);
				return;
			} else if (!devices.length) {
				opts.logger?.trace('No devices found, continuing to wait');
				return;
			}

			// just in case we get any extra events but we already have the deviceId, just return
			if (deviceId) {
				return;
			}

			opts.logger?.trace(`Found ${devices.length} devices, checking if any of them are the emulator...`);

			emulib.isRunning(config, emu, devices, (err, running) => {
				if (err) {
					// TODO: this could be bad... maybe we should emit an error event?
					opts.logger?.trace(`Error checking if emulator is running: ${err}`);
				} else if (!running) {
					// try again
					opts.logger?.trace('Emulator not running yet, continuing to wait');
				} else {
					// running!
					opts.logger?.trace('Emulator is running!');
					Object.assign(emulator, running);
					deviceId = running.id;
					conn.end(); // no need to track devices anymore

					// keep polling until the boot animation has finished
					opts.logger?.trace('Checking if boot animation has finished...');
					(function checkBootAnim() {
						// emulator is running, now shell into it and check if it has booted
						adb.shell(deviceId, 'getprop init.svc.bootanim', (err, output) => {
							if (!err && output.toString().split('\n').shift().trim() === 'stopped') {
								clearTimeout(bootTimer);
								opts.logger?.trace('Emulator is booted, emitting booted event');
								emulator.emit('booted', emulator);
							} else {
								opts.logger?.trace(`Emulator is not booted yet; checking again in ${retryTimeout} ms`);
								setTimeout(checkBootAnim, retryTimeout);
							}
						});
					}());
				}
			});
		});

		emulator.on('booted', async () => {
			opts.logger?.info('Emulator is booted');

			if (!opts.checkMounts || !emu.sdcard) {
				// nothing to do, fire ready event
				opts.logger?.info('SD card not required, skipping mount check');
				emulator.emit('ready', emulator);
				return;
			}

			opts.logger?.info('Checking if SD card is mounted');

			// keep polling /sdcard until it's mounted
			let done = false;
			while (!done) {
				await new Promise(resolve => {
					adb.shell(deviceId, 'cd /sdcard && echo "SDCARD READY"', (err, output) => {
						if (!err && output.toString().split('\n').shift().trim() === 'SDCARD READY') {
							done = true;
							resolve();
						} else {
							setTimeout(resolve, retryTimeout);
						}
					});
				});
			}

			let mounted = false;
			const mountPoints = [ '/sdcard', '/mnt/sdcard' ];
			sdcardTimer = setTimeout(function () {
				if (sdcardTimeout) {
					emulator.emit('timeout', { type: 'sdcard', waited: sdcardTimeout });
				}
				done = true;
			}, sdcardTimeout || 30000);

			adb.shell(deviceId, 'ls -l /sdcard', async (err, output) => {
				if (!err) {
					const m = output.toString().trim().split('\n').shift().trim().match(/-> (\S+)/);
					if (m && mountPoints.indexOf(m[1]) === -1) {
						mountPoints.unshift(m[1]);
					}
				}

				opts.logger?.debug(`Checking mount points: ${mountPoints.join(', ')}`);

				// wait for the sd card to be mounted
				while (!mounted) {
					await new Promise(resolve => {
						adb.shell(deviceId, 'mount', (err, output) => {
							const check = line => {
								const  parts = line.trim().split(' ');
								return parts.length > 1 && mountPoints.indexOf(parts[1]) !== -1;
							};

							if (!err && output.toString().trim().split('\n').some(check)) {
								mounted = true;
								clearTimeout(sdcardTimer);
								opts.logger?.debug('SD card is mounted');
								resolve();
							} else {
								setTimeout(resolve, retryTimeout);
							}
						});
					});
				}

				// requery the devices since device state may have changed
				adb.devices((err, devices) => {
					if (err) {
						opts.logger?.trace(`Error checking if emulator is running: ${err}`);
						return;
					}

					emulib.isRunning(config, emu, devices.filter(d => d.id = emulator.id), (err, running) => {
						if (!err && running) {
							Object.assign(emulator, running);
						} else if (err) {
							opts.logger?.trace(`Error checking if emulator is running: ${err}`);
						}
						emulator.emit('ready', emulator);
					});
				});
			});
		});
	}

	/**
	 * Starts the specified emulator, if not already running.
	 * @param {String} id - The id of the emulator
	 * @param {Object} [opts] - Options for detection and launching the emulator
	 * @param {Function} callback - A function to call when the emulator as launched
	 */
	start(id, opts, callback) {
		if (opts && typeof opts === 'function') {
			callback = opts;
			opts = {};
		}

		opts.logger?.trace(`Checking if emulator ${id} is running...`);

		this.isRunning(id, opts, (err, running) => {
			if (err) {
				// something went boom
				return callback(err);
			}

			if (running) {
				// already running
				const emulator = new Emulator();
				Object.assign(emulator, running);
				opts.logger?.info('Emulator already running');
				this.checkedBooted(this.config, opts, emulator);
				callback(null, emulator);
				return;
			}

			opts.logger?.trace('Emulator not running, detecting emulator info');

			// not running, start the emulator
			this.detect(opts, async (err, emus) => {
				if (err) {
					return callback(err);
				}

				const emu = emus.filter(e => e && e.id == id).shift();

				// this should never happen because it would have happened already thanks to isRunning()
				if (!emu) {
					return callback(new Error(`Invalid emulator "${id}"`), null);
				}

				opts.logger?.trace('Starting the emulator...');

				const emulib = await import(path.join(__dirname, 'emulators', `${emu.type}.js`));
				emulib.start(this.config, emu, opts, (err, emulator) => {
					if (err) {
						callback(err);
					} else {
						// give the emulator a second to get started before we start beating up adb
						opts.logger?.trace('Emulator is starting, monitoring boot state...');
						this.checkedBooted(this.config, opts, emulator);
						callback(null, emulator);
					}
				});
			});
		});
	}

	/**
	 * Stops the specified emulator, if running.
	 * @param {String} id - The id of the emulator
	 * @param {Object} [opts] - Options for detection and killing the emulator
	 * @param {Function} callback - A function to call when the emulator as been killed
	 */
	stop(id, opts, callback) {
		if (opts && typeof opts === 'function') {
			callback = opts;
			opts = {};
		}

		this.isRunning(id, opts, async (err, running) => {
			if (err) {
				// something went boom
				callback(err);
			} else if (!running) {
				// already stopped
				callback(new Error(`Emulator "${id}" not running`));
			} else {
				const emulib = await import(path.join(__dirname, 'emulators', `${running.emulator.type}.js`));
				emulib.stop(this.config, running.emulator.name, running, opts, callback);
			}
		});
	}
}
