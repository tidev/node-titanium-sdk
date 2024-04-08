/**
 * @overview
 * Library for controlling an Android Emulator.
 *
 * @module lib/emulators/avd
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

const appc = require('node-appc'),
	__ = appc.i18n(__dirname).__,
	async = require('async'),
	android = require('../android'),
	net = require('net'),
	spawn = require('child_process').spawn,
	EmulatorManager = require('../emulator');

/**
 * Detects all existing Android Virtual Devices.
 * @param {Object} config - The CLI config object
 * @param {Object} opts - Detect options
 * @param {Boolean} [opts.bypassCache=false] - Bypasses the Android environment detection cache and re-queries the system
 * @param {Function} callback - A function to call when the detection has completed
 */
exports.detect = function detect(config, opts, callback) {
	opts = opts || {};
	android.detect(config, opts, function (results) {
		callback(null, results);
	});
};

function getAvdName(port, callback) {
	let state = 'connecting',
		avdName = null,
		buffer = '';
	const responseRegExp = /(.*)\r\nOK\r\n/;
	const socket = net.connect({ port: port });

	socket.on('data', function (data) {
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

	socket.on('end', function () {
		callback(null, avdName);
	});

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
exports.isRunning = function isRunning(config, emu, devices, callback) {
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
};

/**
 * Detects if a specific device name is an Android emulator.
 * @param {Object} config - The CLI config object
 * @param {Object} device - The device name
 * @param {Function} callback - A function to call when the detection has completed
 * @returns {void}
 */
exports.isEmulator = function isEmulator(config, device, callback) {
	const port = device.match(/^emulator-(\d+)$/);

	if (!port) {
		return callback();
	}

	appc.async.parallel(this, {
		avdName: function (next) {
			getAvdName(port[1], next);
		},
		androidInfo: function (next) {
			this.detect(config, null, next);
		}
	}, function (err, results) {
		if (err) {
			callback(true);
		} else {
			callback(null, results.androidInfo.avds.filter(e => e.id === results.avdName).shift());
		}
	});
};

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
exports.start = function start(config, emu, opts, callback) {
	opts = opts || {};

	android.detect(config, { bypassCache: opts.bypassCache }, function (results) {
		if (!results.sdk) {
			return callback(new Error(__('No Android SDK found')));
		}

		// if they passed in the emulator name, get the emulator avd definition
		if (emu && typeof emu === 'string') {
			const name = emu;
			emu = results.avds.filter(e => e && e.name === name).shift();
			if (!emu) {
				return callback(new Error(__('Invalid emulator "%s"', name)), null);
			}
		}

		// check that 32-bit libs are good to go
		if (results.linux64bit) {
			if (results.linux64bit.ia32libs === false) {
				return callback(new appc.exception(
					__('32-bit libraries is not installed.'),
					__('To install the required 32-bit libraries, run "%s".', 'sudo apt-get install ia32-libs')
				));
			}

			if (results.linux64bit.glibc === false) {
				return callback(new appc.exception(
					__('32-bit glibc library is not installed.'),
					__('To install the required 32-bit glibc library, run "%s".', 'sudo yum install glibc.i686')
				));
			}

			if (results.linux64bit.libstdcpp === false) {
				return callback(new appc.exception(
					__('32-bit libstdc++ library is not installed.'),
					__('To install the required 32-bit libstdc++ library, run "%s".', 'sudo yum install libstdc++.i686')
				));
			}
		}

		var port = opts.port,
			tryPort = 5554; // port must be between 5554 and 5584

		opts.logger && opts.logger.trace(__('Scanning ports to find a port for the emulator to listening on'));

		// we need to find a port to tell the emulator to listen on
		async.whilst(
			function (cb) { cb(null, !port); },
			function (cb) {
				var socket = net.connect({ port: tryPort }, function () {
					// port taken, try again
					socket.end();
					tryPort++;
					cb(tryPort > 5584 ? new Error(__('Unable to find a free port between 5554 and 5584')) : null);
				});

				socket.on('end', function (_err) {
					if (socket) {
						socket.end();
						socket = null;
					}
				});

				socket.on('error', function (err) {
					if (err.code === 'ECONNREFUSED') {
						// port available!
						if (socket) {
							socket.end();
							socket = null;
						}
						port = tryPort;
						cb();
					}
				});
			},
			function (err) {
				if (err) {
					return callback(err);
				}

				opts.logger && opts.logger.trace(__('Emulator will listen on port %s', String(port).cyan));

				// default args
				var args = [
					'-avd', emu.id,                                  // use a specific android virtual device
					'-port', port,                                   // TCP port that will be used for the console
				];

				if (opts.partitionSize !== undefined) {
					args.push('-partition-size', opts.partitionSize);  // system/data partition size in MBs
				}

				if (opts.sdcard) {
					args.push('-sdcard', opts.sdcard); // SD card image (default <system>/sdcard.img)
				}

				// add any other args
				opts.logcat               && args.push('-logcat', opts.logcat);                // enable logcat output with given tags
				opts.sysdir               && args.push('-sysdir', opts.sysdir);                // search for system disk images in <dir>
				opts.system               && args.push('-system', opts.system);                // read initial system image from <file>
				opts.datadir              && args.push('-datadir', opts.datadir);              // write user data into <dir>
				opts.kernel               && args.push('-kernel', opts.kernel);                // use specific emulated kernel
				opts.ramdisk              && args.push('-ramdisk', opts.ramdisk);              // ramdisk image (default <system>/ramdisk.img
				opts.initdata             && args.push('-init-data', opts.initdata);           // same as '-init-data <file>'
				opts.data                 && args.push('-data', opts.data);                    // data image (default <datadir>/userdata-qemu.img
				opts.cache                && args.push('-cache', opts.cache);                  // cache partition image (default is temporary file)
				opts.cacheSize            && args.push('-cache-size', opts.cacheSize);         // cache partition size in MBs
				opts.noCache              && args.push('-no-cache');                           // disable the cache partition
				opts.snapStorage          && args.push('-snapstorage', opts.snapStorage);      // file that contains all state snapshots (default <datadir>/snapshots.img)
				opts.noSnapStorage        && args.push('-no-snapstorage');                     // do not mount a snapshot storage file (this disables all snapshot functionality)
				opts.snapshot             && args.push('-snapshot', opts.snapshot);            // name of snapshot within storage file for auto-start and auto-save (default 'default-boot')
				opts.noSnapshot           && args.push('-no-snapshot');                        // perform a full boot and do not do not auto-save, but qemu vmload and vmsave operate on snapstorage
				opts.noSnapshotSave       && args.push('-no-snapshot-save');                   // do not auto-save to snapshot on exit: abandon changed state
				opts.noSnapshotLoad       && args.push('-no-snapshot-load');                   // do not auto-start from snapshot: perform a full boot
				opts.snapshotList         && args.push('-snapshot-list');                      // show a list of available snapshots
				opts.noSnapshotUpdateTime && args.push('-no-snapshot-update-time');            // do not do try to correct snapshot time on restore
				opts.wipeData             && args.push('-wipe-data');                          // reset the user data image (copy it from initdata)
				opts.skindir              && args.push('-skindir', opts.skindir);              // search skins in <dir> (default <system>/skins)
				opts.skin                 && args.push('-skin', opts.skin);                    // select a given skin
				opts.noSkin               && args.push('-no-skin');                            // don't use any emulator skin
				opts.dynamicSkin          && args.push('-dynamic-skin');                       // dynamically construct a skin of given size, requires -skin WxH option
				opts.memory               && args.push('-memory', opts.memory);                // physical RAM size in MBs
				opts.netspeed             && args.push('-netspeed', opts.netspeed);            // maximum network download/upload speeds
				opts.netdelay             && args.push('-netdelay', opts.netdelay);            // network latency emulation
				opts.netfast              && args.push('-netfast');                            // disable network shaping
				opts.trace                && args.push('-trace', opts.trace);                  // enable code profiling (F9 to start)
				opts.showKernel           && args.push('-show-kernel');                        // display kernel messages
				opts.shell                && args.push('-shell');                              // enable root shell on current terminal
				opts.noJNI                && args.push('-no-jni');                             // disable JNI checks in the Dalvik runtime
				opts.noAudio              && args.push('-no-audio');                           // disable audio support
				opts.audio                && args.push('-audio', opts.audio);                  // use specific audio backend
				opts.rawKeys              && args.push('-raw-keys');                           // disable Unicode keyboard reverse-mapping
				opts.radio                && args.push('-radio', opts.radio);                  // redirect radio modem interface to character device
				opts.onion                && args.push('-onion', opts.onion);                  // use overlay PNG image over screen
				opts.onionAlpha           && args.push('-onion-alpha', opts.onionAlpha);       // specify onion-skin translucency
				opts.onionRotation        && args.push('-onion-rotation', opts.onionRotation); // specify onion-skin rotation 0|1|2|3
				opts.scale                && args.push('-scale', opts.scale);                  // scale emulator window
				opts.dpiDevice            && args.push('-dpi-device', opts.dpiDevice);         // specify device's resolution in dpi (default 165)
				opts.httpProxy            && args.push('-http-proxy', opts.httpProxy);         // make TCP connections through a HTTP/HTTPS proxy
				opts.timezone             && args.push('-timezone', opts.timezone);            // use this timezone instead of the host's default
				opts.dnsServer            && args.push('-dns-server', opts.dnsServer);         // use this DNS server(s) in the emulated system
				opts.cpuDelay             && args.push('-cpu-delay', opts.cpuDelay);           // throttle CPU emulation
				opts.noWindow             && args.push('-no-window');                          // disable graphical window display
				opts.reportConsole        && args.push('-report-console', opts.reportConsole); // report console port to remote socket
				opts.gps                  && args.push('-gps', opts.gps);                      // redirect NMEA GPS to character device
				opts.keyset               && args.push('-keyset', opts.keyset);                // specify keyset file name
				opts.shellSerial          && args.push('-shell-serial', opts.shellSerial);     // specific character device for root shell
				opts.tcpdump              && args.push('-tcpdump', opts.tcpdump);              // capture network packets to file
				opts.bootchart            && args.push('-bootchart', opts.bootchart);          // enable bootcharting
				opts.charmap              && args.push('-charmap', opts.charmap);              // use specific key character map
				opts.sharedNetId          && args.push('-shared-net-id', opts.sharedNetId);    // join the shared network, using IP address 10.1.2.<number>
				opts.nandLimits           && args.push('-nand-limits', opts.nandLimits);       // enforce NAND/Flash read/write thresholds
				opts.memcheck             && args.push('-memcheck', opts.memcheck);            // enable memory access checking
				opts.gpu                  && args.push('-gpu', opts.gpu);                      // set hardware OpenGLES emulation mode
				opts.cameraBack           && args.push('-camera-back', opts.cameraBack);       // set emulation mode for a camera facing back
				opts.cameraFront          && args.push('-camera-front', opts.cameraFront);     // set emulation mode for a camera facing front
				opts.screen               && args.push('-screen', opts.screen);                // set emulated screen mode
				opts.force32bit           && args.push('-force-32bit');                        // always use 32-bit emulator

				// set system property on boot
				if (opts.props && typeof opts.props === 'object') {
					Object.keys(opts.props).forEach(function (prop) {
						args.push('-prop', prop + '=' + opts.props[prop]);
					});
				}

				// pass arguments to qemu
				if (Array.isArray(opts.qemu)) {
					args.push('-qemu');
					args = args.concat(opts.qemu);
				}

				var emuopts = {
					detached: Object.prototype.hasOwnProperty.call(opts, 'detached') ? !!opts.detached : true,
					stdio: opts.stdio// || 'ignore'
				};
				opts.cwd && (emuopts.cwd = opts.cwd);
				opts.env && (emuopts.env = opts.env);
				opts.uid && (emuopts.uid = opts.uid);
				opts.gid && (emuopts.gid = opts.gid);

				opts.logger && opts.logger.info(__('Running: %s', (results.sdk.executables.emulator + ' "' + args.join('" "') + '"').cyan));

				var child = spawn(results.sdk.executables.emulator, args, emuopts),
					device = new EmulatorManager.Emulator();

				device.emulator = {
					pid: child.pid
				};
				appc.util.mix(device.emulator, emu);

				child.stdout && child.stdout.on('data', function (data) {
					device.emit('stdout', data);
				});

				child.stderr && child.stderr.on('data', function (data) {
					device.emit('stderr', data);
				});

				child.on('error', function (err) {
					device.emit('error', err);
				});

				child.on('close', function (code, signal) {
					device.emit('exit', code, signal);
				});

				child.unref();

				callback(null, device);
			}
		);
	});
};

/**
 * Kills the specified Android emulator.
 * @param {Object} config - The CLI config object
 * @param {String} name - The name of the emulator
 * @param {Object} device - Android device definition object
 * @param {Object} opts - Emulator options object
 * @param {String} [opts.titaniumHomeDir="~/.titanium"] - The Titanium home directory
 * @param {Boolean} [opts.bypassCache=false] - Bypasses the Genymotion environment detection cache and re-queries the system
 * @param {String} [opts.cwd] - The current working directory to pass into spawn()
 * @param {Array|String} [opts.stdio="ignore"] - The stdio configuration to pass into spawn()
 * @param {Object} [opts.env] - The environment variables to pass into spawn()
 * @param {Boolean} [opts.detached=true] - The detached flag to pass into spawn()
 * @param {Number} [opts.uid] - The user id to pass into spawn()
 * @param {Number} [opts.gid] - The group id to pass into spawn()
 * @param {Function} callback - A function to call when the emulator is stopped
 */
exports.stop = function stop(config, name, device, opts, callback) {
	if (opts && typeof opts === 'function') {
		callback = opts;
		opts = {};
	} else {
		opts = opts || {};
	}

	android.detect(config, { bypassCache: opts.bypassCache }, function (results) {
		if (!results.sdk) {
			return callback(new Error(__('No Android SDK found')));
		}

		// if they passed in the emulator name, get the emulator avd definition
		const emu = results.avds.filter(e => e && e.name === name).shift();
		if (!emu) {
			return callback(new Error(__('Invalid emulator "%s"', name)), null);
		}

		exports.isRunning(config, emu, [ device ], function (err, running) {
			if (err || !running) {
				return callback(err);
			}
			appc.subprocess.run(results.sdk.executables.adb, [ '-s', device.id, 'emu', 'kill' ], function (code, out, err) {
				callback(code, code ? err : out);
			});
		});
	});
};
