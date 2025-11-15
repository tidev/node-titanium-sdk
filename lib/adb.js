import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import StreamSplitter from 'stream-splitter';
import { spawn } from 'node:child_process';
import { EmulatorManager } from './emulator.js';

let connCounter = 0;

/**
 * Debug flag that is enabled via the android.debugadb setting.
 */
let DEBUG = false;

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

export class Connection {
	/**
	 * Creates an Connection object.
	 * @param {ADB} adb - The ADB instance
	 */
	constructor(adb) {
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
	 * @param {Object} [opts] - Execute options
	 * @param {Boolean} [opts.bufferUntilClose=false] - Buffers all received data until ADB closes the connection
	 */
	exec(cmd, opts) {
		return new Promise((resolve, reject) => {
			let socket = this.socket;
			const doSend = !!socket;
			let buffer = null;
			let len = null;

			const send = () => {
				if (DEBUG) {
					console.log(`[${this.connNum}] SENDING ${cmd}`);
				}
				conn.state = WAIT_FOR_COMMAND_RESULT;
				buffer = null;
				socket.write(('0000' + cmd.length.toString(16)).substr(-4).toUpperCase() + cmd);
			};

			this.opts = opts || {};

			if (!socket) {
				socket = this.socket = net.connect({
					port: this.port,
					family: 4
				}, () => {
					if (DEBUG) {
						console.log(`[${this.connNum}] CONNECTED`);
					}

					// TIMOB-24906: in some circumstances sending a command to adb right away
					// can yield no response. So we allow 200ms before sending the initial command
					setTimeout(() => send(), 200);
				});

				socket.setKeepAlive(true);
				socket.setNoDelay(true);
			} else {
				if (DEBUG) {
					console.log(`[${this.connNum}] SOCKET ALREADY OPEN, RE-LISTENING AND SENDING NEW COMMAND "${cmd}"`);
				}
				socket.removeAllListeners('data');
				socket.removeAllListeners('end');
				socket.removeAllListeners('error');
			}

			socket.on('data', (data) => {
				if (DEBUG) {
					console.log(`[${this.connNum}] RECEIVED ${data.length} BYTES (state=${this.state}) (cmd=${cmd})`);
				}

				if (this.state === DO_NOTHING) {
					return;
				}

				if (!buffer || buffer.length === 0) {
					buffer = data;
				} else {
					buffer += data;
				}

				if (DEBUG) {
					console.log(`[${this.connNum}] BUFFER LENGTH = ${buffer.length}`);
				}

				while (true) {
					switch (this.state) {
						case WAIT_FOR_COMMAND_RESULT:
							const result = buffer.slice(0, 4).toString();
							if (DEBUG) {
								console.log(`[${this.connNum}] RESULT "${result}"`);
							}
							if (!/^OKAY|FAIL$/.test(result)) {
								reject(new Error(`Unknown adb result "${result}"`));
								return;
							}
							buffer = buffer.slice(4);

							// did we fail?
							if (result === 'FAIL') {
								len = 0;
								if (buffer.length >= 4) {
									len = parseInt(buffer.slice(0, 4), 16);
									if (isNaN(len)) {
										len = 0;
									}
									buffer = buffer.slice(4);
								}
								if (len) {
									buffer = buffer.slice(0, len);
								}
								if (DEBUG) {
									console.log(`[${this.connNum}] ERROR! "${buffer.toString()}"`);
								}
								this.state = DO_NOTHING;

								// copy the buffer into an error so we can free up the buffer
								const err = new Error(buffer.toString());
								buffer = null;
								reject(err);
								conn.end();
								return;
							}

							// if there's no more data, then we're done
							if (buffer.length === 0) {
								if (this.opts.bufferUntilClose) {
									if (DEBUG) {
										console.log(`[${this.connNum}] DONE, SETTING STATE TO BUFFER_UNTIL_CLOSE`);
									}
									this.state = BUFFER_UNTIL_CLOSE;
								} else if (this.opts.waitForResponse) {
									if (DEBUG) {
										console.log(`[${this.connNum}] DONE, SETTING STATE TO WAIT_FOR_NEW_DATA`);
									}
									this.state = WAIT_FOR_NEW_DATA;
								} else {
									if (DEBUG) {
										console.log(`[${this.connNum}] DONE, SETTING STATE TO DO_NOTHING`);
									}
									this.state = DO_NOTHING;
									resolve();
								}
								return;
							}

							// if we aren't expecting the data to have a length (i.e. the shell command),
							// then buffer immediately
							if (this.opts.noLength) {
								if (DEBUG) {
									console.log(`[${this.connNum}] PUSHING REMAINING DATA INTO BUFFER AND SETTING STATE TO BUFFER_UNTIL_CLOSE`);
								}
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
								if (DEBUG) {
									console.log(`[${this.connNum}] DETERMINING EXPECTED LENGTH...`);
								}
								if (isNaN(len)) {
									len = null;
								}
								buffer = buffer.slice(4);
							}

							// if there's no length, then let's fire the callback or wait until the socket closes
							if (len === 0) {
								if (DEBUG) {
									console.log(`[${this.connNum}] NO EXPECTED LENGTH, FIRING CALLBACK`);
								}
								resolve();
								buffer = null;
								len = null;
								return;
							} else if (len === null) {
								if (DEBUG) {
									console.log(`[${this.connNum}] NO EXPECTED LENGTH`);
								}
								if (this.opts.bufferUntilClose) {
									if (DEBUG) {
										console.log(`[${this.connNum}] BUFFERING DATA UNTIL SOCKET CLOSE`);
									}
									this.state = BUFFER_UNTIL_CLOSE;
								} else  {
									buffer = null;
									len = null;
									this.state = WAIT_FOR_NEW_DATA;
									resolve();
								}
								return;
							}

							if (DEBUG) {
								console.log(`[${this.connNum}] EXPECTED LENGTH = ${len}`);
								console.log(`[${this.connNum}] BUFFER LENGTH = ${buffer.length}`);
							}

							// do we have enough bytes?
							if (buffer.length >= len) {
								// yup
								const result = buffer.slice(0, len);
								buffer = buffer.slice(len);
								if (DEBUG) {
									console.log(`[${this.connNum}] SUCCESS AND JUST THE RIGHT AMOUNT OF BYTES (${len}) WITH ${buffer.length} BYTES LEFT`);
								}
								if (this.opts.bufferUntilClose) {
									this.state = BUFFER_UNTIL_CLOSE;
								} else {
									this.state = WAIT_FOR_NEW_DATA;
									len = null;
									buffer = null;
									resolve(result);
								}
							} else {
								// we need more data!
								if (DEBUG) {
									console.log(`[${this.connNum}] WAITING FOR MORE DATA`);
								}
							}
							return;

						case BUFFER_UNTIL_CLOSE:
							// we've already added data to the buffer
							return;

						case WAIT_FOR_RESPONSE:
							if (DEBUG) {
								console.log(`[${this.connNum}] DONE, RECEIVED RESPONSE`);
							}
							this.state = DO_NOTHING;
							resolve(buffer);
							return;
					}
				}
			});

			socket.on('end', () => {
				if (DEBUG) {
					console.log(`[${this.connNum}] SOCKET CLOSED BY SERVER ${buffer && buffer.length}`);
				}
				if (buffer) {
					if (!this.opts.waitForResponse) {
						resolve(buffer);
					}
					buffer = null;
				}
				this.end();
			});

			socket.on('error', (err) => {
				this.end();

				if (!err.code || err.code !== 'ECONNREFUSED') {
					return reject(err);
				}

				this.adb.startServer()
					.then(() => this.exec(cmd, this.opts))
					.then(resolve)
					.catch(reject);
			});

			if (doSend) {
				send();
			}
		});
	}

	/**
	 * Closes the connection and resets the socket and state.
	 */
	end() {
		if (this.socket) {
			try {
				this.socket.end();
			} catch {
				// ignore
			}
			this.socket = null;
		}
		this.state = DO_NOTHING;
	}
}

/**
 * Helper function that loads the Android detection library and detects the adb settings.
 * @param {Config} config CLI config
 */
async function androidDetect(config) {
	const { detect } = await import('./android.js');
	const results = await detect(config);
	if (!results.sdk?.executables?.adb) {
		throw new Error('Android SDK not found');
	}
	return results;
}

export class ADB {
	/**
	 * Creates an ADB object.
	 * @class
	 * @classdesc Provides methods to interact with the Android Debug Bridge (ADB).
	 * @constructor
	 * @param {Config} [config] cli config
	 */
	constructor(config) {
		this.config = config;
		if (config?.get('android.debugadb', false)) {
			DEBUG = true;
		}
	}

	/**
	 * Returns the version of the ADB server.
	 */
	async version() {
		const conn = new Connection(this);
		const data = await conn.exec('host:version');
		if (data === null || data === undefined) {
			throw new Error(`Unable to get adb version, received value ${data}`);
		}
		const version = parseInt(data, 16);
		if (isNaN(version)) {
			throw new Error(`Unable to get adb version, received value ${data}`);
		}
		return `1.0.${version}`;
	}

	/**
	 * Parses the device list, then fetches additional device info.
	 * @param {Buffer|String} data - The buffer containing the list of devices
	 */
	async parseDevices(data) {
		const emuMgr = new EmulatorManager(this.config);

		const results = await Promise.all(data.toString().split('\n').map(async line => {
			const p = line.split(/\s+/);
			if (p.length <= 1) {
				return;
			}

			const info = {
				id: p.shift(),
				state: p.shift()
			};

			if (info.state !== 'device') {
				emuMgr.isEmulator(info.id, (_err, emu) => {
					info.emulator = emu || false;
					done(null, info);
				});
				return;
			}

			return new Promise((resolve) => {
				this.shell(info.id, 'getprop', (err, data) => {
					if (!err && data) {
						const re = /^\[([^\]]*)\]: \[(.*)\]\s*$/;
						data.toString().split('\n').forEach(line => {
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
									default:
										if (key.startsWith('ro.product.cpu.abi')) {
											if (!Array.isArray(info.abi)) {
												info.abi = [];
											}
											for (const abi of value.split(',').map(abi => abi.trim())) {
												if (abi && !info.abi.includes(abi)) {
													info.abi.push(abi);
												}
											}
										}
										break;
								}
							}
						});
					}

					emuMgr.isEmulator(info.id, (_err, emu) => {
						info.emulator = emu || false;
						resolve(info);
					});
				});
			});
		}));

		return results.filter(Boolean);
	}

	/**
	 * Retrieves a list of all devices and emulators, then listens for changes to devices.
	 * @param {ADB~trackDevicesCallback} callback - A function that is continually called with the list of devices
	 * @returns {Connection} The connection so you can end() it.
	 */
	trackDevices(callback) {
		const conn = new Connection(this);

		let isProcessing = false;
		const taskQueue = [];

		const processNext = () => {
			if (isProcessing || taskQueue.length === 0) {
				return;
			}

			isProcessing = true;
			const task = taskQueue.shift();

			this.parseDevices((err, results) => {
				callback(err, results);
				isProcessing = false;
				processNext();
			}, task.err, task.data);
		};

		conn.exec('host:track-devices', (err, data) => {
			taskQueue.push({ err, data });
			processNext();
		}, { waitForResponse: true });

		return conn;
	}

	/**
	 * Attempts to find the adb executable, then start the adb server.
	 * @param {ADB~startServerCallback} callback - A function that is called when the server has started
	 */
	async startServer() {
		const results = await androidDetect(this.config);
		const child = spawn(results.sdk.executables.adb, 'start-server', { stdio: ['ignore', 'ignore', 'pipe'] });
		let stderr = '';
		child.stderr.on('data', (data) => {
			stderr += data.toString();
		});
		return new Promise((resolve, reject) => {
			child.on('close', (code) => {
				if (code) {
					reject(new Error(`Failed to start ADB (code ${code}): ${stderr}`));
				} else {
					resolve();
				}
			});
		});
	}

	/**
	 * Attempts to find the adb executable, then stop the adb server.
	 * @param {ADB~stopServerCallback} callback - A callback that is fired when the server has stopped
	 */
	async stopServer() {
		const results = await androidDetect(this.config);
		const child = spawn(results.sdk.executables.adb, 'kill-server', { stdio: 'ignore' });
		return new Promise((resolve, reject) => {
			child.on('close', (code) => {
				if (code) {
					reject(new Error(`Failed to stop ADB (code ${code})`));
				} else {
					resolve();
				}
			});
		});
	}

	/**
	 * Runs the specified command on the Android emulator/device. Note that ADB
	 * converts all \n to \r\n. So data will probably be larger than the original
	 * output on the device.
	 * @param {String} deviceId - android emulator id (of form 'android-5554', gotten from emulator.id after starting it (not to be confused with ids from emulator.detect listing))
	 * @param {String} cmd - The command to run
	 * @param {ADB~shellCallback} callback - A callback that is fired when the command has completed
	 */
	async shell(deviceId, cmd) {
		const conn = new Connection(this);
		return new Promise((resolve, reject) => {
			conn.exec(`host:transport:${deviceId}`, (err, _data) => {
				if (err) {
					reject(err);
				} else {
					conn.exec(`shell:${cmd.replace(/^shell:/, '')}`, (err, result) => {
						if (err) {
							reject(err);
						} else {
							resolve(result);
						}
					}, { bufferUntilClose: true, noLength: true });
				}
			});
		});
	}

	/**
	 * Installs an app to the specified device/emulator.
	 * @param {String} deviceId - The id of the device or emulator
	 * @param {String} apkFile - The application apk file to install
	 * @param {Object} [opts] - Install options
	 * @param {Object} [opts.logger] - A logger instance
	 * @param {ADB~installAppCallback} callback - A callback that is fired when the application has been installed
	 */
	installApp(deviceId, apkFile, opts, callback) {
		if (typeof opts === 'function') {
			callback = opts;
			opts = {};
		}
		apkFile = expand(apkFile);
		if (!fs.existsSync(apkFile)) {
			callback(new Error(`APK file "${apkFile}" does not exist`));
			return;
		}

		this.devices((err, devices) => {
			if (err) {
				return callback(err);
			}

			// Fetch info about the device we're installing to.
			devices = devices.filter(d => d.id === deviceId);
			if (devices.length < 1) {
				return callback(new Error('device not found'));
			}
			const deviceInfo = devices[0];

			androidDetect(this.config, (err, results) => {
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
				opts.logger?.trace(`Executing: ${[ results.sdk.executables.adb ].concat(args).join(' ')}`);
				const child = spawn(results.sdk.executables.adb, args, { stdio: ['ignore', 'pipe', 'pipe'] });
				let stdout = '';
				let stderr = '';
				child.stdout.on('data', (data) => {
					stdout += data.toString();
				});
				child.stderr.on('data', (data) => {
					stderr += data.toString();
				});
				child.on('close', (code) => {
					const m = stdout.match(/^Failure \[(.+)\]$/m);
					if ((code && stderr.includes('No space left on device')) || (!code && m?.[1] === 'INSTALL_FAILED_INSUFFICIENT_STORAGE')) {
						callback(new Error('Not enough free space on device'));
					} else if (m && m[1] === 'INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES') {
						callback(`The app is already installed, but signed with a different certificate\nYou need to either manually uninstall the app or rebuild using the same certificate that was used to sign the installed app`);
					} else if (m) {
						callback(new Error(m[1]));
					} else if (code) {
						callback(new Error(stdout.trim() + '\n' + stderr.trim()));
					} else {
						// no obvious errors, now we need to check stdout
						const m = stdout.match(/^Error: (.+)$/m);
						if (m) {
							callback(new Error(m[1]));
						} else {
							callback();
						}
					}
				});
			});
		});
	}

	/**
	 * Returns the ps output of the specified app and device/emulator, if running.
	 * @param {String} deviceId - The id of the device or emulator
	 * @param {ADB~psCallback} callback - A callback that is fired once ps is executed
	 */
	ps(deviceId, callback) {
		const outputCallback = (err, data) => {
			if (err) {
				callback(err);
			} else {
				// old ps, does not support '-A' parameter
				const dataStr = data.toString().trim();
				if (dataStr.startsWith('bad pid \'-A\'') || dataStr.endsWith('NAME')) {
					this.shell(deviceId, 'ps', outputCallback);
				} else {
					callback(null, data);
				}
			}
		};
		this.shell(deviceId, 'ps -A', outputCallback);
	}

	/**
	 * Returns the pid of the specified app and device/emulator, if running.
	 * @param {String} deviceId - The id of the device or emulator
	 * @param {String} appid - The application's id
	 * @param {ADB~getPidCallback} callback - A callback that is fired once the pid has been determined
	 */
	getPid(deviceId, appid, callback) {
		this.ps(deviceId, (err, data) => {
			if (err) {
				callback(err);
			} else {
				const lines = data.toString().split('\n');
				let columns;
				for (let i = 0, len = lines.length; i < len; i++) {
					columns = lines[i].trim().split(/\s+/);
					if (columns.pop() == appid) {
						callback(null, parseInt(columns[1]));
						return;
					}
				}
				callback(null, 0);
			}
		});
	}

	/**
	 * Starts an application on the specified device/emulator.
	 * @param {String} deviceId - The id of the device or emulator
	 * @param {String} appid - The application's id
	 * @param {String} activity - The name of the activity to run
	 * @param {ADB~startAppCallback} callback - A function that is called once the application has been started
	 */
	startApp(deviceId, appid, activity, callback) {
		// This launches the app via an intent just like how the Android OS would do it when tapping on the app.
		// Notes:
		// - The "-n" sets the intent's component name. Needed by explicit intents.
		// - The "-a" sets the intent's action.
		// - The "-c" sets the intent's category.
		// - The "-f 0x10200000" sets intent flags: FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
		this.shell(deviceId, `am start -n ${appid}/.${activity.replace(/^\./, '')} -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -f 0x10200000`, callback);
	}

	/**
	 * Stops an application on the specified device/emulator.
	 * @param {String} deviceId - The id of the device or emulator
	 * @param {String} appid - The application's id
	 * @param {ADB~stopAppCallback} callback - A function that is called once the application has been stopped
	 */
	stopApp(deviceId, appid, callback) {
		this.getPid(deviceId, appid, (err, pid) => {
			if (!err && pid) {
				this.shell(deviceId, `am force-stop ${appid}`, (err, data) => {
					if (data.toString().includes('Unknown command: force-stop')) {
						this.shell(deviceId, `kill ${pid}`, callback);
					} else {
						callback(err, data);
					}
				});
				return;
			}
			callback(new Error(`Application "${appid}" is not running`));
		});
	}

	/**
	 * Forwards the specified device/emulator's socket connections to the destination.
	 * @param {String} deviceId - The id of the device or emulator
	 * @param {String} src - The source port in the format "tcp:<port>"
	 * @param {String} dest - The destination port in the format "tcp:<port>" or "jdwp:<pid>"
	 * @param {ADB~forwardCallback} callback - A function that is called once the sockets have been forwarded
	 */
	forward(deviceId, src, dest, callback) {
		androidDetect(this.config, (err, results) => {
			if (err) {
				return callback(err);
			}
			const child = spawn(results.sdk.executables.adb, [ '-s', deviceId, 'forward', src, dest ], { stdio: 'ignore' });
			child.on('close', callback);
		});
	}

	/**
	 * Pushes a single file to a device or emulator.
	 * @param {String} deviceId - The id of the device or emulator
	 * @param {String} src - The source file to copy to the device
	 * @param {String} dest - The destination to write the file
	 * @param {ADB~pushCallback} callback - A function that is called once the file has been copied
	 */
	push(deviceId, src, dest, callback) {
		src = expand(src);
		if (!fs.existsSync(src)) {
			callback(new Error(`Source file "${src}" does not exist`));
		} else {
			androidDetect(this.config, (err, results) => {
				if (err) {
					return callback(err);
				}
				const child = spawn(results.sdk.executables.adb, [ '-s', deviceId, 'push', src, dest ], { stdio: 'ignore' });
				child.on('close', callback);
			});
		}
	}

	/**
	 * Pulls a single file from a device or emulator.
	 * @param {String} deviceId - The id of the device or emulator
	 * @param {String} src - The source file to copy from the device
	 * @param {String} dest - The destination to write the file
	 * @param {ADB~pullCallback} callback - A function that is called once the file has been copied
	 */
	pull(deviceId, src, dest, callback) {
		dest = expand(dest);
		const destDir = path.dirname(dest);

		try {
			fs.mkdirSync(destDir, { recursive: true });

			androidDetect(this.config, (err, results) => {
				if (err) {
					return callback(err);
				}
				const child = spawn(results.sdk.executables.adb, [ '-s', deviceId, 'pull', src, dest ], { stdio: 'ignore' });
				child.on('close', callback);
			});
		} catch {
			callback(new Error(`Failed to create destination directory "${destDir}"`));
		}
	}

	/**
	 * Streams output from logcat into the specified handler until the adb logcat
	 * process ends.
	 * @param {String} deviceId - The id of the device or emulator
	 * @param {Function} handler - A function to call whenever data becomes available
	 * @param {Function} callback - A function that is called once 'adb logcat' exits
	 */
	logcat(deviceId, handler, callback) {
		androidDetect(this.config, (err, results) => {
			if (err) {
				return callback(err);
			}

			const child = spawn(results.sdk.executables.adb, [ '-s', deviceId, 'logcat', '-v', 'brief', '-b', 'main' ]); // , '-s', '*:d,*,TiAPI:V']);
			const splitter = child.stdout.pipe(StreamSplitter('\n'));

			// Set encoding on the splitter Stream, so tokens come back as a String.
			splitter.encoding = 'utf8';
			splitter.on('token', (data) => handler(data));

			child.on('close', () => callback());
		});
	}
}
