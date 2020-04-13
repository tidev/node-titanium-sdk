/**
 * A library for interacting with the Android Debug Bridge (adb).
 *
 * This library directly communicates over TCP/IP with the adb server using the
 * service commands found here:
 * {@link https://android.googlesource.com/platform/system/core/+/master/adb/SERVICES.TXT}
 *
 * @module adb
 *
 * @copyright
 * Copyright (c) 2009-2017 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

const appc = require('node-appc');
const __ = appc.i18n(__dirname).__;
const async = require('async');
const fs = require('fs-extra');
const net = require('net');
const path = require('path');
const spawn = require('child_process').spawn; // eslint-disable-line security/detect-child-process
const StreamSplitter = require('stream-splitter');

require('colors');

let connCounter = 0;

module.exports = ADB;

/**
 * Debug flag that is enabled via the android.debugadb setting.
 */
var DEBUG = false;

/**
 * @constant
 * Initial state. Also set if a command fails or the connection is closed.
 */
const DO_NOTHING = 0;

/**
 * @constant
 * After a command is executed, this will wait for the OKAY/FAIL response.
 */
const WAIT_FOR_COMMAND_RESULT = 1;

/**
 * @constant
 * After a command executes and we have received the OKAY/FAIL, then we process
 * whatever data is left. Certain commands, such as track-devices, keep sending
 * more data that begins with the length of data expected.
 */
const WAIT_FOR_NEW_DATA = 2;

/**
 * @constant
 * After a command is executed, this will wait for additional data until the
 * connection is closed. This is for "adb shell" commands where the exact
 * output length is unknown.
 */
const BUFFER_UNTIL_CLOSE = 3;

/**
 * @constant
 * After a command is executed, wait for a response before executing the callback
 */
const WAIT_FOR_RESPONSE = 4;

/**
 * @typedef {Function} ConfigGetFunction
 * @param {string} key key of the value to retrieve
 * @param {*} [defaultValue=undefined] default value to return if not in config
 * @returns {*}
 */

/**
 * CLI Config
 * @typedef {Object} Config
 * @property {ConfigGetFunction} get method to retrieve config values
 */

/**
 * Creates an Connection object.
 * @class
 * @classdesc Manages the connection and communcations with the ADB server.
 * @constructor
 * @param {ADB} adb - The ADB instance
 */
function Connection(adb) {
	this.adb = adb;
	this.port = adb.config && adb.config.get('android.adb.port') || 5037;
	this.socket = null;
	this.state = DO_NOTHING;
	this.connNum = ++connCounter;
}

/**
 * Executes a command. If there is no connection to the ADB server, it will
 * connect to it, then run the command.
 * @param {String} cmd - The command to run
 * @param {Connection~execCallback} callback - A function to call when the command is finished executing
 * @param {Object} [opts] - Execute options
 * @param {Boolean} [opts.bufferUntilClose=false] - Buffers all received data until ADB closes the connection
 */
Connection.prototype.exec = function exec(cmd, callback, opts) {
	var conn = this,
		socket = this.socket,
		doSend = !!socket,
		buffer = null,
		len = null;
	function send () {
		DEBUG && console.log('[' + conn.connNum + '] SENDING ' + cmd);
		conn.state = WAIT_FOR_COMMAND_RESULT;
		buffer = null;
		socket.write(('0000' + cmd.length.toString(16)).substr(-4).toUpperCase() + cmd);
	}

	this.opts = opts || {};

	if (!socket) {
		socket = this.socket = net.connect({
			port: this.port
		}, function () {
			DEBUG && console.log('[' + this.connNum + '] CONNECTED');

			// TIMOB-24906: in some circumstances sending a command to adb right away
			// can yield no response. So we allow 200ms before sending the initial command
			setTimeout(function () {
				send();
			}, 200);
		}.bind(this));

		socket.setKeepAlive(true);
		socket.setNoDelay(true);
	} else {
		DEBUG && console.log('[' + this.connNum + '] SOCKET ALREADY OPEN, RE-LISTENING AND SENDING NEW COMMAND "' + cmd + '"');
		socket.removeAllListeners('data');
		socket.removeAllListeners('end');
		socket.removeAllListeners('error');
	}

	socket.on('data', function (data) {
		DEBUG && console.log('[' + this.connNum + '] RECEIVED ' + data.length + ' BYTES (state=' + this.state + ') (cmd=' + cmd + ')');

		if (this.state === DO_NOTHING) {
			return;
		}

		if (!buffer || buffer.length === 0) {
			buffer = data;
		} else {
			buffer += data;
		}

		DEBUG && console.log('[' + this.connNum + '] BUFFER LENGTH = ' + buffer.length);

		while (1) {
			switch (this.state) {
				case WAIT_FOR_COMMAND_RESULT:
					const result = buffer.slice(0, 4).toString();
					DEBUG && console.log('[' + this.connNum + '] RESULT ' + result);
					if (!/^OKAY|FAIL$/.test(result)) {
						callback(new Error(__('Unknown adb result "%s"', result)));
						return;
					}
					buffer = buffer.slice(4);

					// did we fail?
					if (result === 'FAIL') {
						len = 0;
						if (buffer.length >= 4) {
							len = parseInt(buffer.slice(0, 4), 16);
							isNaN(len) && (len = 0);
							buffer = buffer.slice(4);
						}
						len && (buffer = buffer.slice(0, len));
						DEBUG && console.log('[' + this.connNum + '] ERROR! ' + buffer.toString());
						this.state = DO_NOTHING;

						// copy the buffer into an error so we can free up the buffer
						var err = new Error(buffer.toString());
						buffer = null;
						callback(err);
						conn.end();
						return;
					}

					// if there's no more data, then we're done
					if (buffer.length === 0) {
						if (this.opts.bufferUntilClose) {
							DEBUG && console.log('[' + this.connNum + '] DONE, SETTING STATE TO BUFFER_UNTIL_CLOSE');
							this.state = BUFFER_UNTIL_CLOSE;
						} else if (this.opts.waitForResponse) {
							DEBUG && console.log('[' + this.connNum + '] DONE, SETTING STATE TO WAIT_FOR_NEW_DATA');
							this.state = WAIT_FOR_NEW_DATA;
						} else {
							DEBUG && console.log('[' + this.connNum + '] DONE, SETTING STATE TO DO_NOTHING');
							this.state = DO_NOTHING;
							callback();
						}
						return;
					}

					// if we aren't expecting the data to have a length (i.e. the shell command),
					// then buffer immediately
					if (this.opts.noLength) {
						DEBUG && console.log('[' + this.connNum + '] PUSHING REMAINING DATA INTO BUFFER AND SETTING STATE TO BUFFER_UNTIL_CLOSE');
						this.state = BUFFER_UNTIL_CLOSE;
						return;
					}

					this.state = WAIT_FOR_NEW_DATA;
					len = null; // we don't know the length yet
					// purposely fall through

				case WAIT_FOR_NEW_DATA:
					// find how many bytes we are waiting for
					if (len === null && buffer.length >= 4) {
						len = parseInt(buffer.slice(0, 4), 16);
						DEBUG && console.log('[' + this.connNum + '] DETERMINING EXPECTED LENGTH...');
						isNaN(len) && (len = null);
						buffer = buffer.slice(4);
					}

					// if there's no length, then let's fire the callback or wait until the socket closes
					if (len === 0) {
						DEBUG && console.log('[' + this.connNum + '] NO EXPECTED LENGTH, FIRING CALLBACK');
						callback();
						buffer = null;
						len = null;
						return;
					} else if (len === null) {
						DEBUG && console.log('[' + this.connNum + '] NO EXPECTED LENGTH');
						if (this.opts.bufferUntilClose) {
							DEBUG && console.log('[' + this.connNum + '] BUFFERING DATA UNTIL SOCKET CLOSE');
							this.state = BUFFER_UNTIL_CLOSE;
						} else  {
							buffer = null;
							len = null;
							this.state = WAIT_FOR_NEW_DATA;
							callback();
						}
						return;
					}

					DEBUG && console.log('[' + this.connNum + '] EXPECTED LENGTH = ' + len);
					DEBUG && console.log('[' + this.connNum + '] BUFFER LENGTH = ' + buffer.length);

					// do we have enough bytes?
					if (buffer.length >= len) {
						// yup
						const result = buffer.slice(0, len);
						buffer = buffer.slice(len);
						DEBUG && console.log('[' + this.connNum + '] SUCCESS AND JUST THE RIGHT AMOUNT OF BYTES (' + len + ') WITH ' + buffer.length + ' BYTES LEFT');
						if (this.opts.bufferUntilClose) {
							this.state = BUFFER_UNTIL_CLOSE;
						} else {
							this.state = WAIT_FOR_NEW_DATA;
							len = null;
							buffer = null;
							callback(null, result);
						}
					} else {
						// we need more data!
						DEBUG && console.log('[' + this.connNum + '] WAITING FOR MORE DATA');
					}
					return;

				case BUFFER_UNTIL_CLOSE:
					// we've already added data to the buffer
					return;
				case WAIT_FOR_RESPONSE:
					DEBUG && console.log('[' + this.connNum + '] DONE, RECEIVED RESPONSE');
					this.state = DO_NOTHING;
					callback(null, buffer);
					return;
			}
		}
	}.bind(this));

	socket.on('end', function () {
		DEBUG && console.log('[' + this.connNum + '] SOCKET CLOSED BY SERVER', (buffer && buffer.length));
		if (buffer) {
			if (!this.opts.waitForResponse) {
				callback(null, buffer);
			}
			buffer = null;
		}
		this.end();
	}.bind(this));

	socket.on('error', function (err) {
		this.end();

		if (!err.errno || err.errno !== 'ECONNREFUSED') {
			return callback(err);
		}

		this.adb.startServer(function (code) {
			if (code) {
				callback(new Error(__('Unable to start Android Debug Bridge server (exit code %s)', code)));
			} else {
				this.exec(cmd, callback, this.opts);
			}
		}.bind(this));
	}.bind(this));

	doSend && send();
};

/**
 * Closes the connection and resets the socket and state.
 */
Connection.prototype.end = function end() {
	if (this.socket) {
		try {
			this.socket.end();
		} catch (ex) {
			// ignore
		}
		this.socket = null;
	}
	this.state = DO_NOTHING;
};

/**
 * Creates an ADB object.
 * @class
 * @classdesc Provides methods to interact with the Android Debug Bridge (ADB).
 * @constructor
 * @param {Config} [config] cli config
 */
function ADB(config) {
	this.config = config;
	if (config && config.get('android.debugadb', false)) {
		DEBUG = true;
	}
}

/**
 * Returns the version of the ADB server.
 * @param {ADB~versionCallback} callback - A function to call when the version has been retreived
 */
ADB.prototype.version = function version(callback) {
	const conn = new Connection(this);
	conn.exec('host:version', function (err, data) {
		if (err) {
			return callback(err);
		}
		if (data === null || data === undefined) {
			return callback(new Error(`Unable to get adb version, received value ${data}`));
		}
		// Check if parseInt result is NaN?
		callback(null, '1.0.' + parseInt(data, 16));
	});
};

/**
 * Parses the device list, then fetches additional device info.
 * @param {ADB} adb - The ADB instance
 * @param {Function} callback - A function to call when the devices have been parsed
 * @param {Error} err - An error if the list devices call failed
 * @param {Buffer|String} data - The buffer containing the list of devices
 */
function parseDevices(adb, callback, err, data) {
	if (err) {
		callback(err);
		return;
	}

	var EmulatorManager = require('./emulator'),
		emuMgr = new EmulatorManager(adb.config);

	async.series((data || '').toString().split('\n').map(function (line) {
		return function (done) {
			var p = line.split(/\s+/);
			if (p.length <= 1) {
				return done();
			}

			var info = {
				id: p.shift(),
				state: p.shift()
			};

			if (info.state !== 'device') {
				emuMgr.isEmulator(info.id, function (err, emu) {
					info.emulator = emu || false;
					done(null, info);
				});
				return;
			}

			adb.shell(info.id, 'getprop', function (err, data) {
				if (!err && data) {
					const re = /^\[([^\]]*)\]: \[(.*)\]\s*$/;
					data.toString().split('\n').forEach(function (line) {
						const m = line.match(re);
						if (m) {
							const key = m[1];
							const value = m[2];

							switch (key) {
								case 'ro.product.model.internal':
									info.modelnumber = value;
									break;
								case 'ro.build.version.release':
								case 'ro.build.version.sdk':
								case 'ro.product.brand':
								case 'ro.product.device':
								case 'ro.product.manufacturer':
								case 'ro.product.model':
								case 'ro.product.name':
									info[key.split('.').pop()] = value;
									break;
								case 'ro.genymotion.version':
									info.genymotion = value;
									break;
								default:
									if (key.indexOf('ro.product.cpu.abi') === 0) {
										Array.isArray(info.abi) || (info.abi = []);
										value.split(',').forEach(function (abi) {
											abi = abi.trim();
											if (abi && info.abi.indexOf(abi) === -1) {
												info.abi.push(abi);
											}
										});
									}
									break;
							}
						}
					});
				}

				emuMgr.isEmulator(info.id, function (err, emu) {
					info.emulator = emu || false;
					done(null, info);
				});
			});
		};
	}), function (err, results) {
		callback(null, results.filter(device => !!device));
	});
}

/**
 * Retrieves a list of all devices and emulators.
 * @param {ADB~devicesCallback} callback - A function that is called with the list of devices
 */
ADB.prototype.devices = function devices(callback) {
	new Connection(this).exec('host:devices', function (err, data) {
		parseDevices(this, callback, err, data);
	}.bind(this), { waitForResponse: true });
};

/**
 * Retrieves a list of all devices and emulators, then listens for changes to devices.
 * @param {ADB~trackDevicesCallback} callback - A function that is continually called with the list of devices
 * @returns {Connection} The connection so you can end() it.
 */
ADB.prototype.trackDevices = function trackDevices(callback) {
	var conn = new Connection(this),
		_t = this,
		queue = async.queue(function (task, next) {
			parseDevices(_t, function (err, results) {
				callback(err, results);
				next();
			}, task.err, task.data);
		}, 1);

	conn.exec('host:track-devices', function (err, data) {
		queue.push({ err: err, data: data });
	}, { waitForResponse: true });

	return conn;
};

/**
 * Helper function that loads the Android detection library and detects the adb settings.
 * @param {Config} config CLI config
 * @param {Function} callback async callback
 */
function androidDetect(config, callback) {
	(require('./android')).detect(config, null, function (results) {
		for (var i = 0, l = results.issues.length; i < l; i++) {
			if (results.issues[i].id === 'ANDROID_MISSING_32BIT_LIBS') {
				return callback(new Error(results.issues[i].message));
			}
		}

		if (results.sdk && results.sdk.executables.adb) {
			callback(null, results);
		} else {
			callback(new Error(__('Android SDK not found')));
		}
	});
}

/**
 * Attempts to find the adb executable, then start the adb server.
 * @param {ADB~startServerCallback} callback - A function that is called when the server has started
 */
ADB.prototype.startServer = function startServer(callback) {
	androidDetect(this.config, function (err, results) {
		if (err) {
			return callback(err);
		}
		appc.subprocess.run(results.sdk.executables.adb, 'start-server', function (code, out, err) {
			callback(code ? new Error(__('Failed to start ADB (code %s): %s', code, err)) : null);
		});
	});
};

/**
 * Attempts to find the adb executable, then stop the adb server.
 * @param {ADB~stopServerCallback} callback - A callback that is fired when the server has stopped
 */
ADB.prototype.stopServer = function stopServer(callback) {
	androidDetect(this.config, function (err, results) {
		if (err) {
			return callback(err);
		}
		appc.subprocess.run(results.sdk.executables.adb, 'kill-server', function (code, _out, _err) {
			callback(code);
		});
	});
};

/**
 * Runs the specified command on the Android emulator/device. Note that ADB
 * converts all \n to \r\n. So data will probably be larger than the original
 * output on the device.
 * @param {String} deviceId - android emulator id (of form 'android-5554', gotten from emulator.id after starting it (not to be confused with ids from emulator.detect listing))
 * @param {String} cmd - The command to run
 * @param {ADB~shellCallback} callback - A callback that is fired when the command has completed
 */
ADB.prototype.shell = function shell(deviceId, cmd, callback) {
	var conn = new Connection(this);
	conn.exec('host:transport:' + deviceId, function (err, _data) {
		if (err) {
			callback(err);
		} else {
			conn.exec('shell:' + cmd.replace(/^shell:/, ''), function (err, result) {
				callback(err, result);
			}, { bufferUntilClose: true, noLength: true });
		}
	});
};

/**
 * Installs an app to the specified device/emulator.
 * @param {String} deviceId - The id of the device or emulator
 * @param {String} apkFile - The application apk file to install
 * @param {Object} [opts] - Install options
 * @param {Object} [opts.logger] - A logger instance
 * @param {ADB~installAppCallback} callback - A callback that is fired when the application has been installed
 */
ADB.prototype.installApp = function installApp(deviceId, apkFile, opts, callback) {
	if (typeof opts === 'function') {
		callback = opts;
		opts = {};
	}
	apkFile = appc.fs.resolvePath(apkFile);
	if (!fs.existsSync(apkFile)) {
		callback(new Error(__('APK file "%s" does not exist', apkFile)));
		return;
	}

	this.devices(function (err, devices) {
		if (err) {
			return callback(err);
		}

		// Fetch info about the device we're installing to.
		devices = devices.filter(d => d.id === deviceId);
		if (devices.length < 1) {
			return callback(new Error(__('device not found')));
		}
		const deviceInfo = devices[0];

		androidDetect(this.config, function (err, results) {
			if (err) {
				return callback(err);
			}

			// Fetch the device's API Level.
			let deviceApiLevel = 1;
			if (deviceInfo.sdk) {
				const value = parseInt(deviceInfo.sdk);
				if (!isNaN(value)) {
					deviceApiLevel = value;
				}
			}

			// Set up the 'adb' arguments array.
			const args = [];
			args.push('-s', deviceId);
			args.push('install');
			args.push('-r');
			if (deviceApiLevel >= 17) {
				// Allow installation of an older APK version over a newer one.
				// Note: Only supported on Android 4.2 (API Level 17) and higher.
				args.push('-d');
			}
			args.push(apkFile);

			// Run the adb install command.
			opts.logger && opts.logger.trace(__('Executing: %s', [ results.sdk.executables.adb ].concat(args).join(' ').cyan));
			appc.subprocess.run(results.sdk.executables.adb, args, function (code, out, err) {
				var m = out.match(/^Failure \[(.+)\]$/m);
				if ((code && err.indexOf('No space left on device') !== -1) || (!code && m && m[1] === 'INSTALL_FAILED_INSUFFICIENT_STORAGE')) {
					callback(new Error(__('Not enough free space on device')));
				} else if (m && m[1] === 'INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES') {
					callback(__('The app is already installed, but signed with a different certificate') + '\n'
						+ __('You need to either manually uninstall the app or rebuild using the same certificate that was used to sign the installed app'));
				} else if (m) {
					callback(new Error(m[1]));
				} else if (code) {
					callback(new Error(out.trim() + '\n' + err.trim()));
				} else {
					// no obvious errors, now we need to check stdout
					m = out.match(/^Error: (.+)$/m);
					if (m) {
						callback(new Error(m[1]));
					} else {
						callback();
					}
				}
			});
		});
	}.bind(this));
};

/**
 * Returns the ps output of the specified app and device/emulator, if running.
 * @param {String} deviceId - The id of the device or emulator
 * @param {ADB~psCallback} callback - A callback that is fired once ps is executed
 */
ADB.prototype.ps = function ps(deviceId, callback) {
	var outputCallback = function (err, data) {
		if (err) {
			callback(err);
		} else {
			// old ps, does not support '-A' parameter
			var dataStr = data.toString().trim();
			if (dataStr.startsWith('bad pid \'-A\'') || dataStr.endsWith('NAME')) {
				this.shell(deviceId, 'ps', outputCallback);
			} else {
				callback(null, data);
			}
		}
	}.bind(this);
	this.shell(deviceId, 'ps -A', outputCallback);
};

/**
 * Returns the pid of the specified app and device/emulator, if running.
 * @param {String} deviceId - The id of the device or emulator
 * @param {String} appid - The application's id
 * @param {ADB~getPidCallback} callback - A callback that is fired once the pid has been determined
 */
ADB.prototype.getPid = function getPid(deviceId, appid, callback) {
	this.ps(deviceId, function (err, data) {
		if (err) {
			callback(err);
		} else {
			var lines = data.toString().split('\n'),
				i = 0,
				len = lines.length,
				columns;
			for (; i < len; i++) {
				columns = lines[i].trim().split(/\s+/);
				if (columns.pop() == appid) { // eslint-disable-line eqeqeq
					callback(null, parseInt(columns[1]));
					return;
				}
			}
			callback(null, 0);
		}
	});
};

/**
 * Starts an application on the specified device/emulator.
 * @param {String} deviceId - The id of the device or emulator
 * @param {String} appid - The application's id
 * @param {String} activity - The name of the activity to run
 * @param {ADB~startAppCallback} callback - A function that is called once the application has been started
 */
ADB.prototype.startApp = function startApp(deviceId, appid, activity, callback) {
	// This launches the app via an intent just like how the Android OS would do it when tapping on the app.
	// Notes:
	// - The "-n" sets the intent's component name. Needed by explicit intents.
	// - The "-a" sets the intent's action.
	// - The "-c" sets the intent's category.
	// - The "-f 0x10200000" sets intent flags: FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
	this.shell(deviceId, 'am start -n ' + appid + '/.' + activity.replace(/^\./, '') + ' -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -f 0x10200000', callback);
};

/**
 * Stops an application on the specified device/emulator.
 * @param {String} deviceId - The id of the device or emulator
 * @param {String} appid - The application's id
 * @param {ADB~stopAppCallback} callback - A function that is called once the application has been stopped
 */
ADB.prototype.stopApp = function stopApp(deviceId, appid, callback) {
	this.getPid(deviceId, appid, function (err, pid) {
		if (!err && pid) {
			this.shell(deviceId, 'am force-stop ' + appid, function (err, data) {
				if (data.toString().indexOf('Unknown command: force-stop') !== -1) {
					this.shell(deviceId, 'kill ' + pid, callback);
				} else {
					callback(err, data);
				}
			}.bind(this));
			return;
		}
		callback(new Error(__('Application "%s" is not running', appid)));
	}.bind(this));
};

/**
 * Forwards the specified device/emulator's socket connections to the destination.
 * @param {String} deviceId - The id of the device or emulator
 * @param {String} src - The source port in the format "tcp:<port>"
 * @param {String} dest - The destination port in the format "tcp:<port>" or "jdwp:<pid>"
 * @param {ADB~forwardCallback} callback - A function that is called once the sockets have been forwarded
 */
ADB.prototype.forward = function forward(deviceId, src, dest, callback) {
	androidDetect(this.config, function (err, results) {
		if (err) {
			return callback(err);
		}
		appc.subprocess.run(results.sdk.executables.adb, [ '-s', deviceId, 'forward', src, dest ], function (code, _out, _err) {
			callback(code);
		});
	});
};

/**
 * Pushes a single file to a device or emulator.
 * @param {String} deviceId - The id of the device or emulator
 * @param {String} src - The source file to copy to the device
 * @param {String} dest - The destination to write the file
 * @param {ADB~pushCallback} callback - A function that is called once the file has been copied
 */
ADB.prototype.push = function push(deviceId, src, dest, callback) {
	src = appc.fs.resolvePath(src);
	if (!fs.existsSync(src)) {
		callback(new Error(__('Source file "%s" does not exist', src)));
	} else {
		androidDetect(this.config, function (err, results) {
			if (err) {
				return callback(err);
			}
			appc.subprocess.run(results.sdk.executables.adb, [ '-s', deviceId, 'push', src, dest ], function (code, _out, _err) {
				callback(code);
			});
		});
	}
};

/**
 * Pulls a single file from a device or emulator.
 * @param {String} deviceId - The id of the device or emulator
 * @param {String} src - The source file to copy from the device
 * @param {String} dest - The destination to write the file
 * @param {ADB~pullCallback} callback - A function that is called once the file has been copied
 */
ADB.prototype.pull = function pull(deviceId, src, dest, callback) {
	dest = appc.fs.resolvePath(dest);
	var destDir = path.dirname(dest);

	try {
		fs.ensureDirSync(destDir);

		androidDetect(this.config, function (err, results) {
			if (err) {
				return callback(err);
			}
			appc.subprocess.run(results.sdk.executables.adb, [ '-s', deviceId, 'pull', src, dest ], function (code, _out, _err) {
				callback(code);
			});
		});
	} catch (ex) {
		callback(new Error(__('Failed to create destination directory "%s"', destDir)));
	}
};

/**
 * Streams output from logcat into the specified handler until the adb logcat
 * process ends.
 * @param {String} deviceId - The id of the device or emulator
 * @param {Function} handler - A function to call whenever data becomes available
 * @param {Function} callback - A function that is called once 'adb logcat' exits
 */
ADB.prototype.logcat = function logcat(deviceId, handler, callback) {
	androidDetect(this.config, function (err, results) {
		if (err) {
			return callback(err);
		}

		var child = spawn(results.sdk.executables.adb, [ '-s', deviceId, 'logcat', '-v', 'brief', '-b', 'main' ]), // , '-s', '*:d,*,TiAPI:V']);
			splitter = child.stdout.pipe(StreamSplitter('\n'));

		// Set encoding on the splitter Stream, so tokens come back as a String.
		splitter.encoding = 'utf8';
		splitter.on('token', function (data) {
			handler(data);
		});

		child.on('close', function () {
			callback();
		});
	});
};

/**
 * A function to call when the version has been retreived.
 * @callback ADB~versionCallback
 * @param {Error} err - In the event of an error, an exception, otherwise falsey
 * @param {String} version - The version of the adb server
 */

/**
 * A function to call when the command is finished executing.
 * @callback Connection~execCallback
 * @param {Error} err - In the event of an error, an exception, otherwise falsey
 * @param {Buffer} data - The output from the executed command
 */

/**
 * A function that is called with the list of devices.
 * @callback ADB~devicesCallback
 * @param {Error} err - In the event of an error, an exception, otherwise falsey
 * @param {Array} devices - An array of devices and emulators found
 */

/**
 * A function that is continually called with the list of devices when the state
 * of any devices or emulators.
 * @callback ADB~trackDevicesCallback
 * @param {Error} err - In the event of an error, an exception, otherwise falsey
 * @param {Array} devices - An array of devices and emulators found
 */

/**
 * A function that is called when the adb start-server has completed.
 * @callback ADB~startServerCallback
 * @param {Number|Error} err - The exit code from adb start-server command or an exception
 */

/**
 * A function that is called when the adb kill-server has completed.
 * @callback ADB~stopServerCallback
 * @param {Number|Error} err - The exit code from adb kill-server command or an exception
 */

/**
 * A function that is called when the shell command has completed.
 * Called after the shell command completes.
 * @callback ADB~shellCallback
 * @param {Error} err - In the event of an error, an exception, otherwise falsey
 * @param {Buffer} data - The output from the executed command
 */

/**
 * A function that is called when the application has been installed.
 * @callback ADB~installAppCallback
 * @param {Number|Error} err - The exit code from adb install command or an exception
 */

/**
 * A callback that is fired once the pid has been determined.
 * @callback ADB~getPidCallback
 * @param {Error} err - In the event of an error, an exception, otherwise falsey
 * @param {Number} pid - The pid or zero if the process is not found
 */

/**
 * A function that is called when the application has been started.
 * @callback ADB~startAppCallback
 * @param {Error} err - In the event of an error, an exception, otherwise falsey
 * @param {Buffer} data - The output from the executed command
 */

/**
 * A function that is called when the application has been stopped.
 * @callback ADB~stopAppCallback
 * @param {Error} err - In the event of an error, an exception, otherwise falsey
 * @param {Buffer} data - The output from the executed command
 */

/**
 * A function that is called once the sockets have been forwarded.
 * @callback ADB~forwardCallback
 * @param {Number|Error} err - The exit code from adb forward command or an exception
 */

/**
 * A function that is called once the file has been copied.
 * @callback ADB~pushCallback
 * @param {Number|Error} err - The exit code from adb forward command or an exception
 */

/**
 * A function that is called once the file has been copied.
 * @callback ADB~pullCallback
 * @param {Number|Error} err - The exit code from adb forward command or an exception
 */

/**
 * A function to call whenever data becomes available.
 * @callback ADB~logcatHandler
 * @param {String} data - One or more lines of logcat output
 */

/**
 * A function that is called once 'adb logcat' exits
 * @callback ADB~logcatCallback
 */
