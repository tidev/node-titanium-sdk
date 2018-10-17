/**
 * @overview
 * Library for controlling a Genymotion emulator.
 *
 * @module lib/emulators/genymotion
 *
 * @copyright
 * Copyright (c) 2009-2014 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

const appc = require('node-appc'),
	__ = appc.i18n(__dirname).__,
	async = require('async'),
	fs = require('fs-extra'),
	path = require('path'),
	spawn = require('child_process').spawn,
	ADB = require('../adb'),
	EmulatorManager = require('../emulator'),
	defaultTitaniumHomeDir = appc.fs.resolvePath('~', '.titanium'),
	exe = process.platform === 'win32' ? '.exe' : '';
let cache;

/**
 * Detects that Genymotion is installed and which Genymotion emulators exist.
 * @param {Object} config - The CLI config object
 * @param {Object} opts - Detect options
 * @param {Boolean} [opts.bypassCache=false] - Bypasses the Genymotion environment detection cache and re-queries the system
 * @param {Function} finished - A function to call when the detection has completed
 * @returns {void}
 */
exports.detect = function detect(config, opts, finished) {
	opts = opts || {};

	if (cache && !opts.bypassCache) {
		return finished(null, cache);
	}

	async.parallel({
		genymotion: function (next) {
			var queue = async.queue(function (task, callback) {
				task(function (err, result) {
					if (err) {
						callback(); // go to next item in the queue
					} else {
						next(null, result);
					}
				});
			}, 1);

			queue.drain = function () {
				// we have completely exhausted all search paths
				next(null, null);
			};

			queue.push([
				// first let's check the config's value
				function (cb) {
					findGenymotion(config.get('genymotion.path'), config, cb);
				},
				// try finding the 'genymotion' executable
				function (cb) {
					appc.subprocess.findExecutable([ config.get('genymotion.executables.genymotion'), 'genymotion' + exe ], function (err, result) {
						if (err) {
							cb(err);
						} else {
							findGenymotion(path.resolve(result, '..', '..'), config, cb);
						}
					});
				}
			]);

			var genyRegexp = /genymo(tion|bile)/i,
				dirs = process.platform === 'win32'
					? [ '%SystemDrive%', '%ProgramFiles%', '%ProgramFiles(x86)%', '%CommonProgramFiles%', '~' ]
					: [ '/opt', '/opt/local', '/usr', '/usr/local', '~' ];

			if (process.platform === 'darwin' && fs.existsSync('/Applications')) {
				dirs.unshift('/Applications');
			}

			dirs.forEach(function (dir) {
				dir = appc.fs.resolvePath(dir);
				try {
					fs.existsSync(dir) && fs.readdirSync(dir).forEach(function (name) {
						var subdir = path.join(dir, name);
						if (genyRegexp.test(name) && name[0] !== '.' && fs.existsSync(subdir) && fs.statSync(subdir).isDirectory()) {
							queue.push(function (cb) {
								findGenymotion(subdir, config, cb);
							});
						}
					});
				} catch (e) {}
			});
		},
		virtualbox: function (next) {
			// try to find the VBoxManage file in the config file or system paths
			appc.subprocess.findExecutable([ config.get('genymotion.executables.vboxmanage'), 'VBoxManage' + exe ], function (err, result) {
				function getVersion(exe) {
					appc.subprocess.run(exe, '--version', function (code, out, err) {
						next(null, {
							vboxmanage: exe,
							version: code ? null : out.trim()
						});
					});
				}

				if (err || !result) {
					// didn't find it, try a deep scanning various paths
					var executableName = 'VBoxManage' + exe,
						queue = async.queue(function (task, callback) {
							task(function (err, result) {
								if (err) {
									callback(); // go to next item in the queue
								} else if (result) {
									getVersion(result);
								} else {
									next(null, null);
								}
							});
						}, 1);

					queue.drain = function () {
						// we have completely exhausted all search paths
						next(null, null);
					};

					queue.push(
						(process.platform === 'win32'
							// default location is C:\Program Files\Oracle\VirtualBox
							? [ '%ProgramFiles%', '%ProgramFiles(x86)%' ]
							: [ '/opt', '/usr', '~' ]
						).map(function (dir) {
							dir = appc.fs.resolvePath(dir);
							return function (next) {
								next(null, fs.existsSync(dir) && (function scan(parent, depth) {
									try {
										var files = fs.readdirSync(parent),
											i = 0,
											l = files.length,
											name, file, stat, result;
										for (; i < l; i++) {
											name = files[i];
											file = path.join(parent, name);
											if (fs.existsSync(file)) {
												stat = fs.statSync(file);
												if (stat.isFile() && name === executableName) {
													return file;
												} else if (stat.isDirectory() && depth) {
													if (result = scan(file, depth - 1)) {
														return result;
													}
												}
											}
										}
									} catch (e) {}
								}(dir, 3))); // we only want to go 3 levels deep
							};
						})
					);
				} else {
					getVersion(result);
				}
			});
		}
	}, function (err, data) {
		var results = data.genymotion || {};
		results.executables || (results.executables = {
			genymotion: null,
			player: null,
			vboxmanage: null
		});
		results.home = null;
		results.avds = [];
		results.issues = [];

		function finalize() {
			finished(null, cache = results);
		}

		if (!data.genymotion) {
			return finalize();
		}

		if (!results.executables.player) {
			results.issues.push({
				id: 'GENYMOTION_MISSING_PLAYER',
				type: 'error',
				message: __('Unable to locate the Genymotion "player" executable.')
			});
		}

		// attempt to find the Genymotion home directory
		var genymotionHomeDirs = [ config.get('genymotion.home') ];
		if (process.platform === 'win32') {
			genymotionHomeDirs.push('~/AppData/Local/Genymobile/Genymotion');
		} else {
			genymotionHomeDirs.push('~/.Genymobile/Genymotion', '~/.Genymotion');
		}
		for (var i = 0; i < genymotionHomeDirs.length; i++) {
			if (genymotionHomeDirs[i]) {
				var dir = appc.fs.resolvePath(genymotionHomeDirs[i]);
				if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
					results.home = dir;
					break;
				}
			}
		}
		if (!results.home) {
			results.issues.push({
				id: 'GENYMOTION_HOME_NOT_FOUND',
				type: 'error',
				message: __('Unable to locate the Genymotion home directory.') + '\n'
					+ __('If you haven\'t launched Genymotion yet, run it quick so that the home directory is created.')
			});
		}

		if (data.virtualbox) {
			results.virtualbox = data.virtualbox.version;
			var vboxmanage = results.executables.vboxmanage = data.virtualbox.vboxmanage;

			if (!vboxmanage) {
				results.issues.push({
					id: 'VIRTUALBOX_MANAGE_NOT_FOUND',
					type: 'error',
					message: __('Unable to locate VirtualBox\'s "VBoxManage" executable.')
				});
				finalize();
			} else {
				// since we found VBoxManage, now we can find all AVDs
				getVMInfo(config, vboxmanage, function (err, emus) {
					results.avds = emus;
					finalize();
				});
			}
		} else {
			results.issues.push({
				id: 'VIRTUALBOX_NOT_FOUND',
				type: 'error',
				message: __('Unable to find VirtualBox which is required for Genymotion to work.')
			});

			finalize();
		}
	});
};

function findGenymotion(dir, config, callback) {
	if (!dir) {
		return callback(true);
	}

	// check if the supplied directory exists and is actually a directory
	dir = appc.fs.resolvePath(dir);
	if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
		return callback(true);
	}

	// find the genymotion executable
	var executableName = 'genymotion' + exe,
		executable = (function scan(parent) {
			var files = fs.readdirSync(parent),
				i = 0,
				l = files.length,
				name, file, stat, result;
			for (; i < l; i++) {
				name = files[i];
				file = path.join(parent, name);
				if (fs.existsSync(file)) {
					stat = fs.statSync(file);
					if (stat.isFile() && name === executableName) {
						return file;
					} else if (stat.isDirectory()) {
						if (result = scan(file)) {
							return result;
						}
					}
				}
			}
		}(dir));

	// check if we found it
	if (!executable) {
		return callback(true);
	}

	// strip off the executable name to get the genymotion directory
	dir = path.dirname(executable);

	var player = config.get('genymotion.executables.player');
	if (!player || !fs.existsSync(player)) {
		player = path.join(dir, 'player' + exe);
	}
	if (!fs.existsSync(player) && process.platform === 'darwin') {
		player = path.join(dir, 'player.app', 'Contents', 'MacOS', 'player');
	}
	if (!fs.existsSync(player)) {
		player = null;
	}

	callback(null, {
		path: dir,
		executables: {
			genymotion: executable,
			player: player
		}
	});
}

function getVMInfo(config, vboxmanage, callback) {
	appc.subprocess.run(vboxmanage, [ 'list', 'vms' ], function (code, out, err) {
		if (code) {
			return callback(null, []);
		}

		async.parallel(out.split('\n').map(function (line) {
			return function (next) {
				line = line.trim();
				if (!line) {
					return next();
				}
				var m = line.match(/^"(.+)" \{(.+)\}$/);
				if (!m) {
					return next();
				}

				var emu = {
					name: m[1],
					guid: m[2],
					type: 'genymotion',
					abi: 'x86',
					googleApis: null, // null means maybe since we don't know for sure unless the emulator is running
					'sdk-version': null
				};

				appc.subprocess.run(vboxmanage, [ 'guestproperty', 'enumerate', emu.guid ], function (code, out, err) {
					if (!code) {
						out.split('\n').forEach(function (line) {
							var m = line.trim().match(/Name: (\S+), value: (\S*), timestamp:/);
							if (m) {
								switch (m[1]) {
									case 'android_version':
										emu['sdk-version'] = emu.target = m[2];
										break;
									case 'genymotion_version':
										emu.genymotion = m[2];
										break;
									case 'hardware_opengl':
										emu.hardwareOpenGL = !!parseInt(m[2]);
										break;
									case 'vbox_dpi':
										emu.dpi = ~~m[2];
										break;
									case 'vbox_graph_mode':
										emu.display = m[2];
										break;
									case 'androvm_ip_management':
										emu.ipaddress = m[2];
										break;
								}
							}
						});
					}

					// if the virtual machine does not define the genymotion version, then
					// it's not a Genymotion virtual machine
					if (!emu.genymotion) {
						emu = null;
					}

					// this is a hack, but by default new Genymotion emulators that have Google APIs will
					// say "Google Apps" in the name, so if we find that, assume it has Google APIs
					if (emu && /google apps/i.test(emu.name)) {
						emu.googleApis = true;
					}

					// if we have an ip address, then the Genymotion emulator is running and
					// we can see if the Google APIs are installed
					if (emu && emu.ipaddress) {
						var adb = new ADB(config);
						adb.shell(emu.ipaddress + ':5555', '[ -f /system/etc/g.prop ] && cat /system/etc/g.prop || echo ""', function (err, out) {
							if (err) {
								// if we errored, then that means the 'androvm_ip_management'
								// was stale and we should just assume it's not running
								emu.ipaddress = null;
							} else {
								emu.googleApis = out ? out.toString().indexOf('gapps') !== -1 : null;
							}
							next(null, emu);
						});
					} else {
						next(null, emu);
					}
				});
			};
		}), function (err, emus) {
			callback(null, emus.filter(a => a));
		});
	});
}

/**
 * Detects if a specific Genymotion VM is running and if so, returns
 * the emulator definition object and the device definition object.
 * @param {Object} emu - The Android emulator avd definition
 * @param {Array<Object>} devices - An array of device definition objects
 * @param {Function} callback - A function to call when the detection has completed
 * @returns {void}
 */
exports.isRunning = function isRunning(config, emu, devices, callback) {
	if (!devices.length || !emu.type === 'genymotion') {
		return callback(null, false);
	}

	function next() {
		var id = emu.ipaddress + ':5555',
			i = 0,
			len = devices.length;

		for (; i < len; i++) {
			if (devices[i].id === id) {
				return callback(null, devices[i]);
			}
		}

		callback(null, false);
	}

	if (emu.ipaddress) {
		next();
	} else {
		// see if we can get the ip address
		this.detect(config, null, function (err, results) {
			if (results.executables.vboxmanage) {
				getVMInfo(config, results.executables.vboxmanage, function (err, emus) {
					emu = emus.filter(function (e) {
						return e && e.name === emu.name;
					}).shift();
					if (emu && emu.ipaddress) {
						return next();
					}
					callback(null, false);
				});
			} else {
				// genymotion not installed
				callback(null, false);
			}
		});
	}
};

/**
 * Detects if a specific device name is an Genymotion emulator.
 * @param {Object} config - The CLI config object
 * @param {Object} device - The device name
 * @param {Function} callback - A function to call when the detection has completed
 */
exports.isEmulator = function isEmulator(config, device, callback) {
	this.detect(config, {}, function (err, results) {
		if (results.executables.vboxmanage) {
			getVMInfo(config, results.executables.vboxmanage, function (err, emus) {
				const emu = emus.filter(function (e) {
					return e && e.ipaddress && device.indexOf(e.ipaddress + ':') === 0;
				}).shift();
				if (emu) {
					return callback(null, emu);
				}
				callback(null, false);
			});
		} else {
			// genymotion not installed
			callback(null, false);
		}
	});
};

/**
 * Launches the specified Genymotion emulator.
 * @param {Object} config - The CLI config object
 * @param {Object|String} emu - The Android emulator avd definition or the name of the emulator
 * @param {Object} opts - Emulator options object
 * @param {String} [opts.titaniumHomeDir="~/.titanium"] - The Titanium home directory
 * @param {Boolean} [opts.bypassCache=false] - Bypasses the Genymotion environment detection cache and re-queries the system
 * @param {String} [opts.cwd] - The current working directory to pass into spawn()
 * @param {Array|String} [opts.stdio="ignore"] - The stdio configuration to pass into spawn()
 * @param {Object} [opts.env] - The environment variables to pass into spawn()
 * @param {Boolean} [opts.detached=true] - The detached flag to pass into spawn()
 * @param {Number} [opts.uid] - The user id to pass into spawn()
 * @param {Number} [opts.gid] - The group id to pass into spawn()
 * @param {Function} callback - A function to call when the emulator is started
 */
exports.start = function start(config, emu, opts, callback) {
	opts = opts || {};

	exports.detect(config, { bypassCache: opts.bypassCache }, function (err, results) {
		if (err) {
			return callback(err);
		}
		if (!results.path) {
			return callback(new Error(__('Unable to find Genymotion installation')));
		}
		if (!results.executables.player) {
			return callback(new Error(__('Unable to find Genymotion "player" executable')));
		}

		// if they passed in the emulator name, get the emulator avd definition
		if (emu && typeof emu === 'string') {
			var name = emu;
			emu = results.avds.filter(e => e && e.name === name).shift();
			if (!emu) {
				return callback(new Error(__('Invalid emulator "%s"', name)), null);
			}
		}

		var emuopts = {
			detached: opts.hasOwnProperty('detached') ? !!opts.detached : true,
			stdio: opts.stdio || 'ignore'
		};
		opts.cwd && (emuopts.cwd = opts.cwd);
		opts.env && (emuopts.env = opts.env);
		opts.uid && (emuopts.uid = opts.uid);
		opts.gid && (emuopts.gid = opts.gid);

		opts.logger && opts.logger.info(__('Running: %s', (results.executables.player + ' --vm-name "' + emu.name + '"').cyan));

		var child = spawn(results.executables.player, [ '--vm-name', emu.name ], emuopts),
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

		var titaniumHomeDir = appc.fs.resolvePath(opts.titaniumHomeDir || defaultTitaniumHomeDir),
			pidDir = path.join(titaniumHomeDir, 'genymotion'),
			pidFile = path.join(pidDir, emu.name + '.pid');
		fs.existsSync(pidFile) && fs.unlinkSync(pidFile);
		fs.ensureDirSync(pidDir);
		fs.writeFileSync(pidFile, child.pid);

		callback(null, device);
	});
};

/**
 * Kills the specified Genymotion emulator.
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

	exports.detect(config, { bypassCache: opts.bypassCache }, function (err, results) {
		var emu = results.avds.filter(e => e && e.name === name).shift();
		if (!emu) {
			return callback(new Error(__('Invalid emulator "%s"', name)), null);
		}

		exports.isRunning(config, emu, [ device ], function (err, running) {
			if (err || !running) {
				return callback(err);
			}

			var titaniumHomeDir = appc.fs.resolvePath(opts.titaniumHomeDir || defaultTitaniumHomeDir),
				pidFile = path.join(titaniumHomeDir, 'genymotion', emu.name + '.pid');
			if (fs.existsSync(pidFile)) {
				var pid = parseInt(fs.readFileSync(pidFile).toString().trim());
				pid && process.kill(pid);
				fs.unlinkSync(pidFile);
			}

			// unclean shutdowns cause adb to notice the emulator went away
			var adb = new ADB(config);
			adb.stopServer(function (err) {
				if (err) {
					return callback();
				}
				adb.startServer(function () {
					callback();
				});
			});
		});
	});
};
