import { detect as detectAndroid } from './android.js';
import { ADB } from './adb.js';
import { EventEmitter } from 'node:events';

export class Emulator extends EventEmitter {}

export class EmulatorManager {
	Emulator = Emulator;

	constructor(config) {
		this.config = config;
	}

	/**
	 * Loads emulator implementation modules and detects all available emulators.
	 * @param {Object} [opts] - Detection options
	 * @param {String} [opts.type] - The type of emulator to load (avd); defaults to all
	 */
	async detect(opts = {}) {
		const androidEnv = await detectAndroid(this.config, opts);
		const ver2api = {};
		const emus = [];

		for (const id of Object.keys(androidEnv.targets)) {
			if (androidEnv.targets[id].type === 'platform') {
				ver2api[androidEnv.targets[id].version] = androidEnv.targets[id].sdk;
			}
		}

		if (Array.isArray(androidEnv.avds)) {
			for (const avd of androidEnv.avds) {
				if (!avd['api-level']) {
					avd['api-level'] = ver2api[avd['sdk-version']] || null;
				}
				if (!avd.id) {
					avd.id = avd.name;
				}
				emus.push(avd);
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
	 */
	async isRunning(id, opts) {
		opts.logger?.trace(`Detecting if ${id} exists...`);

		const emus = await this.detect(opts);
		const emu = emus.filter(e => e && e.id === id).shift();
		if (!emu) {
			throw new Error(`Invalid emulator "${id}"`);
		}

		opts.logger?.trace('Emulator exists, detecting all running emulators and connected devices...');

		// need to see if the emulator is running
		const adb = new ADB(this.config);
		const devices = await adb.devices();
		opts.logger?.trace(`Detected ${devices.length} running emulators and connected devices`);

		// if there are no devices, then it can't possibly be running
		if (!devices.length) {
			return false;
		}

		opts.logger?.trace(`Checking ${devices.length} devices to see if it's the emulator we want`);

		if (emu.type !== 'avd') {
			return false;
		}

		const emuRegExp = /^emulator-(\d+)$/;
		const device = devices.find(d => {
			return d.id.match(emuRegExp) && d.emulator.id === emu.id;
		});

		if (device) {
			opts.logger?.trace('The emulator is running');
		} else {
			opts.logger?.trace('The emulator is NOT running');
		}

		return device;
	}

	/**
	 * Determines if the specified "device name" is an emulator or a device.
	 * @param {String} device - The name of the device returned from 'adb devices'
	 * @param {Object} [opts] - Detection options
	 * @param {String} [opts.type] - The type of emulator to load (avd); defaults to all
	 */
	async isEmulator(device, opts) {
		try {
			const port = device.match(/^emulator-(\d+)$/);
			if (!port) {
				return false;
			}

			const [avdName, androidInfo] = await Promise.all([
				this.getAvdName(port[1]),
				detectAndroid(this.config, opts),
			]);

			return androidInfo.avds.find(e => e.id === avdName);
		} catch {
			throw new Error(`Unable to find device "${device}"`);
		}
	}

	getAvdName(port) {
		return new Promise((resolve, reject) => {
			let state = 'connecting';
			let avdName = null;
			let buffer = '';
			const responseRegExp = /(.*)\r\nOK\r\n/;
			const socket = net.connect({ port: port });

			socket.on('data', (data) => {
				buffer += data.toString();
				const m = buffer.match(responseRegExp);
				if (!m || state === 'done') {
					// do nothing
				} else if (state === 'connecting') {
					state = 'sending command';
					buffer = '';
					socket.write('avd name\n');
				} else if (state === 'sending command') {
					state = 'done';
					avdName = m[1].trim();
					socket.end('quit\n');
				}
			});

			socket.on('end', () => resolve(avdName));

			socket.on('error', reject);
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

		conn = adb.trackDevices(async (err, devices) => {
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

			try {
				const running = await emulib.isRunning(config, emu, devices);
				if (!running) {
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
			} catch {
				// TODO: this could be bad... maybe we should emit an error event?
				opts.logger?.trace(`Error checking if emulator is running: ${err}`);
			}
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
			let retries = 32;
			while (retries-- > 0) {
				try {
					const output = await adb.shell(deviceId, 'cd /sdcard && echo "SDCARD READY"');
					if (output.toString().split('\n').shift().trim() === 'SDCARD READY') {
						break;
					}
				} catch {
					await delay(retryTimeout);
				}
			}

			if (retries <= 0) {
				opts.logger?.error('SD card timed out while waiting to be mounted');
				emulator.emit('timeout', { type: 'sdcard', waited: sdcardTimeout });
				return;
			}

			let mounted = false;
			const mountPoints = [ '/sdcard', '/mnt/sdcard' ];
			sdcardTimer = setTimeout(() => {
				if (sdcardTimeout) {
					emulator.emit('timeout', { type: 'sdcard', waited: sdcardTimeout });
				}
				done = true;
			}, sdcardTimeout || 30000);

			const output = await adb.shell(deviceId, 'ls -l /sdcard');
			const m = output.toString().trim().split('\n').shift().trim().match(/-> (\S+)/);
			if (m && !mountPoints.includes(m[1])) {
				mountPoints.unshift(m[1]);
			}

			opts.logger?.debug(`Checking mount points: ${mountPoints.join(', ')}`);

			// wait for the sd card to be mounted
			while (!mounted) {
				const output = await adb.shell(deviceId, 'mount');
				const check = line => {
					const  parts = line.trim().split(' ');
					return parts.length > 1 && mountPoints.includes(parts[1]);
				};

				if (!err && output.toString().trim().split('\n').some(check)) {
					mounted = true;
					clearTimeout(sdcardTimer);
					opts.logger?.debug('SD card is mounted');
					break;
				} else {
					await delay(retryTimeout);
					break;
				}
			}

			// requery the devices since device state may have changed
			const devices = await adb.devices();
			if (err) {
				opts.logger?.trace(`Error checking if emulator is running: ${err}`);
				return;
			}

			try {
				const running = await emulib.isRunning(config, emu, devices.filter(d => d.id = emulator.id));
				if (running) {
					Object.assign(emulator, running);
				}
			} catch (err) {
				opts.logger?.trace(`Error checking if emulator is running: ${err}`);
			}
			emulator.emit('ready', emulator);
		});
	}

	/**
	 * Starts the specified emulator, if not already running.
	 * @param {String} id - The id of the emulator
	 * @param {Object} [opts] - Options for detection and launching the emulator
	 */
	async start(id, opts) {
		opts.logger?.trace(`Checking if emulator ${id} is running...`);

		const running = await this.isRunning(id, opts);
		if (running) {
			// already running
			const emulator = new Emulator();
			Object.assign(emulator, running);
			opts.logger?.info('Emulator already running');
			this.checkedBooted(this.config, opts, emulator);
			return emulator;
		}

		opts.logger?.trace('Emulator not running, detecting emulator info');

		// not running, start the emulator
		const emus = await this.detect(opts);
		const emu = emus.find(e => e?.id === id);

		// this should never happen because it would have happened already thanks to isRunning()
		if (!emu) {
			throw new Error(`Invalid emulator "${id}"`);
		}

		const androidEnv = await detectAndroid(this.config, opts);
		if (!androidEnv.sdk) {
			throw new Error('No Android SDK found');
		}

		// check that 32-bit libs are good to go
		if (androidEnv.linux64bit) {
			if (androidEnv.linux64bit.ia32libs === false) {
				throw new Error('32-bit libraries is not installed.\nTo install the required 32-bit libraries, run "sudo apt-get install ia32-libs".');
			}
		}

		opts.logger?.trace('Starting the emulator...');

		let { port } = opts;
		let tryPort = 5554; // port must be between 5554 and 5584

		opts.logger?.trace('Scanning ports to find a port for the emulator to listening on');

		// we need to find a port to tell the emulator to listen on
		while (!port) {
			await new Promise((resolve, reject) => {
				let socket = net.connect({ port: tryPort }, () => {
					// port taken, try again
					socket.end();
					tryPort++;
					if (tryPort > 5584) {
						reject(new Error('Unable to find a free port between 5554 and 5584'));
					} else {
						resolve();
					}
				});

				socket.on('end', (_err) => {
					if (socket) {
						socket.end();
						socket = null;
					}
				});

				socket.on('error', (err) => {
					if (err.code === 'ECONNREFUSED') {
						// port available!
						if (socket) {
							socket.end();
							socket = null;
						}
						port = tryPort;
						resolve();
					}
				});
			});
		}

		opts.logger?.trace(`Emulator will listen on port ${port}`);

		// default args
		const args = [
			'-avd', emu.id, // use a specific android virtual device
			'-port', port,  // TCP port that will be used for the console
		];

		const addArg = (prop, option) => {
			if (opts[prop]) {
				args.push(option, opts[prop]);
			}
		};

		if (opts.partitionSize !== undefined) {
			args.push('-partition-size', opts.partitionSize);  // system/data partition size in MBs
		}

		addArg('sdcard', '-sdcard'); // SD card image (default <system>/sdcard.img)

		// add any other args
		addArg('logcat', '-logcat'); // enable logcat output with given tags
		addArg('sysdir', '-sysdir'); // search for system disk images in <dir>
		addArg('system', '-system'); // read initial system image from <file>
		addArg('datadir', '-datadir'); // write user data into <dir>
		addArg('kernel', '-kernel'); // use specific emulated kernel
		addArg('ramdisk', '-ramdisk'); // ramdisk image (default <system>/ramdisk.img
		addArg('initdata', '-init-data'); // same as '-init-data <file>'
		addArg('data', '-data'); // data image (default <datadir>/userdata-qemu.img
		addArg('cache', '-cache'); // cache partition image (default is temporary file)
		addArg('cacheSize', '-cache-size'); // cache partition size in MBs
		addArg('noCache', '-no-cache'); // disable the cache partition
		addArg('snapStorage', '-snapstorage'); // file that contains all state snapshots (default <datadir>/snapshots.img)
		addArg('noSnapStorage', '-no-snapstorage'); // do not mount a snapshot storage file (this disables all snapshot functionality)
		addArg('snapshot', '-snapshot'); // name of snapshot within storage file for auto-start and auto-save (default 'default-boot')
		addArg('noSnapshot', '-no-snapshot'); // perform a full boot and do not do not auto-save, but qemu vmload and vmsave operate on snapstorage
		addArg('noSnapshotSave', '-no-snapshot-save'); // do not auto-save to snapshot on exit: abandon changed state
		addArg('noSnapshotLoad', '-no-snapshot-load'); // do not auto-start from snapshot: perform a full boot
		addArg('snapshotList', '-snapshot-list'); // show a list of available snapshots
		addArg('noSnapshotUpdateTime', '-no-snapshot-update-time'); // do not do try to correct snapshot time on restore
		addArg('wipeData', '-wipe-data'); // reset the user data image (copy it from initdata)
		addArg('skindir', '-skindir'); // search skins in <dir> (default <system>/skins)
		addArg('skin', '-skin'); // select a given skin
		addArg('noSkin', '-no-skin'); // don't use any emulator skin
		addArg('dynamicSkin', '-dynamic-skin'); // dynamically construct a skin of given size, requires -skin WxH option
		addArg('memory', '-memory'); // physical RAM size in MBs
		addArg('netspeed', '-netspeed'); // maximum network download/upload speeds
		addArg('netdelay', '-netdelay'); // network latency emulation
		addArg('netfast', '-netfast'); // disable network shaping
		addArg('trace', '-trace'); // enable code profiling (F9 to start)
		addArg('showKernel', '-show-kernel'); // display kernel messages
		addArg('shell', '-shell'); // enable root shell on current terminal
		addArg('noJNI', '-no-jni'); // disable JNI checks in the Dalvik runtime
		addArg('noAudio', '-no-audio'); // disable audio support
		addArg('audio', '-audio'); // use specific audio backend
		addArg('rawKeys', '-raw-keys'); // disable Unicode keyboard reverse-mapping
		addArg('radio', '-radio'); // redirect radio modem interface to character device
		addArg('onion', '-onion'); // use overlay PNG image over screen
		addArg('onionAlpha', '-onion-alpha'); // specify onion-skin translucency
		addArg('onionRotation', '-onion-rotation'); // specify onion-skin rotation 0|1|2|3
		addArg('scale', '-scale'); // scale emulator window
		addArg('dpiDevice', '-dpi-device'); // specify device's resolution in dpi (default 165)
		addArg('httpProxy', '-http-proxy'); // make TCP connections through a HTTP/HTTPS proxy
		addArg('timezone', '-timezone'); // use this timezone instead of the host's default
		addArg('dnsServer', '-dns-server'); // use this DNS server(s) in the emulated system
		addArg('cpuDelay', '-cpu-delay'); // throttle CPU emulation
		addArg('noWindow', '-no-window'); // disable graphical window display
		addArg('reportConsole', '-report-console'); // report console port to remote socket
		addArg('gps', '-gps'); // redirect NMEA GPS to character device
		addArg('keyset', '-keyset'); // specify keyset file name
		addArg('shellSerial', '-shell-serial'); // specific character device for root shell
		addArg('tcpdump', '-tcpdump'); // capture network packets to file
		addArg('bootchart', '-bootchart'); // enable bootcharting
		addArg('charmap', '-charmap'); // use specific key character map
		addArg('sharedNetId', '-shared-net-id'); // join the shared network, using IP address 10.1.2.<number>
		addArg('nandLimits', '-nand-limits'); // enforce NAND/Flash read/write thresholds
		addArg('memcheck', '-memcheck'); // enable memory access checking
		addArg('gpu', '-gpu'); // set hardware OpenGLES emulation mode
		addArg('cameraBack', '-camera-back'); // set emulation mode for a camera facing back
		addArg('cameraFront', '-camera-front'); // set emulation mode for a camera facing front
		addArg('screen', '-screen'); // set emulated screen mode
		addArg('force32bit', '-force-32bit'); // always use 32-bit emulator

		// set system property on boot
		if (opts.props && typeof opts.props === 'object') {
			for (const prop of Object.keys(opts.props)) {
				args.push('-prop', `${prop}=${opts.props[prop]}`);
			}
		}

		// pass arguments to qemu
		if (Array.isArray(opts.qemu)) {
			args.push('-qemu');
			args.push(...opts.qemu);
		}

		const emuopts = {
			detached: Object.prototype.hasOwnProperty.call(opts, 'detached') ? !!opts.detached : true,
			stdio: opts.stdio // || 'ignore'
		};
		if (opts.cwd) {
			emuopts.cwd = opts.cwd;
		}
		if (opts.env) {
			emuopts.env = opts.env;
		}
		if (opts.uid) {
			emuopts.uid = opts.uid;
		}
		if (opts.gid) {
			emuopts.gid = opts.gid;
		}

		opts.logger?.info(`Running: ${(`${androidEnv.sdk.executables.emulator} "${args.join('" "')}"`)}`);
		const device = new EmulatorManager.Emulator();

		const child = spawn(androidEnv.sdk.executables.emulator, args, emuopts);

		device.emulator = {
			pid: child.pid
		};
		Object.assign(device.emulator, emu);

		child.stdout?.on('data', (data) => {
			device.emit('stdout', data);
		});
		child.stderr?.on('data', (data) => {
			device.emit('stderr', data);
		});

		child.on('error', err => device.emit('error', err));
		child.on('close', (code, signal) => device.emit('exit', code, signal));

		child.unref();

		// give the emulator a second to get started before we start beating up adb
		opts.logger?.trace('Emulator is starting, monitoring boot state...');
		this.checkedBooted(this.config, opts, device);
		return device;
	}

	/**
	 * Stops the specified emulator, if running.
	 * @param {String} id - The id of the emulator
	 * @param {Object} [opts] - Options for detection and killing the emulator
	 */
	async stop(id, opts) {
		const device = await this.isRunning(id, opts);
		if (device) {
			const androidEnv = await detectAndroid(this.config, opts);
			if (!androidEnv.sdk) {
				throw new Error('No Android SDK found');
			}

			// if they passed in the emulator name, get the emulator avd definition
			const emu = androidEnv.avds.find(e => e && e.name === device.emulator.name);
			if (!emu) {
				throw new Error(`Invalid emulator "${device.emulator.name}"`);
			}

			await new Promise((resolve, reject) => {
				const child = spawn(results.sdk.executables.adb, [ '-s', device.id, 'emu', 'kill' ], { stdio: ['ignore', 'pipe', 'pipe']});
				let stdout = '';
				let stderr = '';
				child.stdout.on('data', (data) => {
					stdout += data.toString();
				});
				child.stderr.on('data', (data) => {
					stderr += data.toString();
				});
				child.on('close', (code) => {
					if (code) {
						reject(new Error(`Failed to stop emulator "${id}" (code ${code})`));
					} else {
						resolve();
					}
				});
			});
 		} else {
			// already stopped
			throw new Error(`Emulator "${id}" not running`);
		}
	}
}
