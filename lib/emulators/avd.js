import android from '../android.js';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { EmulatorManager } from '../emulator.js';

/**
 * Detects all existing Android Virtual Devices.
 * @param {Object} config - The CLI config object
 * @param {Object} opts - Detect options
 * @param {Function} callback - A function to call when the detection has completed
 */
export function detect(config, opts, callback) {
	opts = opts || {};
	android.detect(config, opts, (results) => {
		callback(null, results);
	});
}

function getAvdName(port, callback) {
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

	socket.on('end', () => callback(null, avdName));

	socket.on('error', callback);
}

/**
 * Detects if a specific Android Virtual Device is running and if so, returns
 * the emulator AVD definition object and the device definition object.
 * @param {Object} config - The CLI config object
 * @param {Object} emu - The Android emulator avd definition
 * @param {Array<Object>} devices - An array of device definition objects
 * @param {Function} callback - A function to call when the detection has completed
 * @returns {void}
 */
export function isRunning(config, emu, devices, callback) {
	if (emu.type !== 'avd') {
		return callback(null, false);
	}

	const emuRegExp = /^emulator-(\d+)$/;
	const matchingDevice = devices.find(d => {
		const m = d.id.match(emuRegExp);
		return m && d.emulator.id === emu.id;
	});
	// Don't filter by state of 'device' (which means running), because sometimes
	// adb host:track-devices reports "offline' for an emulator just launched with a super fast boot via snapshots
	// and really once it's listed, it's considered "running" (just maybe not fully booted)
	return callback(null, matchingDevice);
}

/**
 * Detects if a specific device name is an Android emulator.
 * @param {Object} config - The CLI config object
 * @param {Object} device - The device name
 * @param {Function} callback - A function to call when the detection has completed
 * @returns {void}
 */
export function isEmulator(config, device, callback) {
	const port = device.match(/^emulator-(\d+)$/);

	if (!port) {
		return callback();
	}

	Promise.all([
		new Promise(resolve => getAvdName(port[1], resolve)),
		new Promise(resolve => this.detect(config, null, resolve)),
	]).then(([avdName, androidInfo]) => {
		callback(null, androidInfo.avds.filter(e => e.id === avdName).shift());
	}).catch(_error => {
		callback(true);
	});
}

/**
 * Launches the specified Android emulator.
 * @param {Object} config - The CLI config object
 * @param {Object|String} emu - The Android emulator avd definition or the name of the emulator
 * @param {Object} [opts] - Emulator start options
 * @param {Boolean} [opts.bypassCache=false] - Bypasses the Android environment detection cache and re-queries the system
 * @param {Number} [opts.port=5560] - The TCP port the emulator will use for the console
 * @param {String} [opts.sdcard] - A path to the virtual SD card to use with the emulator
 * @param {String} [opts.logcatFilter="*:d,*,TiAPI:V"] - The filter for logcat to use
 * @param {Number} [opts.partitionSize=128] - The emulator's system/data partition size in MBs
 * @param {String} [opts.cwd] - The current working directory to pass into spawn()
 * @param {Array|String} [opts.stdio] - The stdio configuration to pass into spawn()
 * @param {Object} [opts.env] - The environment variables to pass into spawn()
 * @param {Boolean} [opts.detached] - The detached flag to pass into spawn()
 * @param {Number} [opts.uid] - The user id to pass into spawn()
 * @param {Number} [opts.gid] - The group id to pass into spawn()
 * @param {Function} callback - A function to call when the emulator is started
 */
export function start(config, emu, opts, callback) {
	opts = opts || {};

	android.detect(config, { bypassCache: opts.bypassCache }, async (results) => {
		if (!results.sdk) {
			return callback(new Error('No Android SDK found'));
		}

		// if they passed in the emulator name, get the emulator avd definition
		if (emu && typeof emu === 'string') {
			const name = emu;
			emu = results.avds.filter(e => e && e.name === name).shift();
			if (!emu) {
				return callback(new Error(`Invalid emulator "${name}"`), null);
			}
		}

		// check that 32-bit libs are good to go
		if (results.linux64bit) {
			if (results.linux64bit.ia32libs === false) {
				return callback(new appc.exception(
					'32-bit libraries is not installed.',
					`To install the required 32-bit libraries, run "sudo apt-get install ia32-libs".`
				));
			}
		}

		var port = opts.port,
			tryPort = 5554; // port must be between 5554 and 5584

		opts.logger?.trace('Scanning ports to find a port for the emulator to listening on');

		// we need to find a port to tell the emulator to listen on
		try {
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
		} catch (err) {
			return callback(err);
		}

		opts.logger?.trace(`Emulator will listen on port ${String(port).cyan}`);

		// default args
		let args = [
			'-avd', emu.id,                                  // use a specific android virtual device
			'-port', port,                                   // TCP port that will be used for the console
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
			args = [...args, ...opts.qemu];
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

		opts.logger?.info(`Running: ${(`${results.sdk.executables.emulator} "${args.join('" "')}"`).cyan}`);

		const child = spawn(results.sdk.executables.emulator, args, emuopts);
		const device = new EmulatorManager.Emulator();

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

		child.on('error', (err) => {
			device.emit('error', err);
		});

		child.on('close', (code, signal) => {
			device.emit('exit', code, signal);
		});

		child.unref();

		callback(null, device);
	});
}

/**
 * Kills the specified Android emulator.
 * @param {Object} config - The CLI config object
 * @param {String} name - The name of the emulator
 * @param {Object} device - Android device definition object
 * @param {Object} opts - Emulator options object
 * @param {String} [opts.titaniumHomeDir="~/.titanium"] - The Titanium home directory
 * @param {Boolean} [opts.bypassCache=false] - Bypasses environment detection cache and re-queries the system
 * @param {String} [opts.cwd] - The current working directory to pass into spawn()
 * @param {Array|String} [opts.stdio="ignore"] - The stdio configuration to pass into spawn()
 * @param {Object} [opts.env] - The environment variables to pass into spawn()
 * @param {Boolean} [opts.detached=true] - The detached flag to pass into spawn()
 * @param {Number} [opts.uid] - The user id to pass into spawn()
 * @param {Number} [opts.gid] - The group id to pass into spawn()
 * @param {Function} callback - A function to call when the emulator is stopped
 */
export function stop(config, name, device, opts, callback) {
	if (opts && typeof opts === 'function') {
		callback = opts;
		opts = {};
	} else {
		opts = opts || {};
	}

	android.detect(config, { bypassCache: opts.bypassCache }, (results) => {
		if (!results.sdk) {
			return callback(new Error('No Android SDK found'));
		}

		// if they passed in the emulator name, get the emulator avd definition
		const emu = results.avds.filter(e => e && e.name === name).shift();
		if (!emu) {
			return callback(new Error(`Invalid emulator "${name}"`), null);
		}

		isRunning(config, emu, [ device ], (err, running) => {
			if (err || !running) {
				return callback(err);
			}
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
				callback(code, code ? stderr : stdout);
			});
		});
	});
}
