/**
 * Detects the Android development environment and its dependencies.
 *
 * @module lib/android
 *
 * @copyright
 * Copyright (c) 2009-2017 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

const fs = require('fs'),
	path = require('path'),
	async = require('async'),
	appc = require('node-appc'),
	manifestJson = appc.pkginfo.manifest(module),
	i18n = appc.i18n(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	afs = appc.fs,
	run = appc.subprocess.run,
	findExecutable = appc.subprocess.findExecutable,
	exe = process.platform === 'win32' ? '.exe' : '',
	cmd = process.platform === 'win32' ? '.cmd' : '',
	bat = process.platform === 'win32' ? '.bat' : '',
	commandPrefix = process.env.APPC_ENV ? 'appc ' : '',
	requiredSdkTools = {
		adb: exe,
		emulator: exe,
		mksdcard: exe,
		zipalign: exe,
		aapt: exe,
		aidl: exe,
		dx: bat
	},
	pkgPropRegExp = /^([^=]*)=\s*(.+)$/;

let envCache;

// Common paths to scan for Android SDK/NDK
const dirs = process.platform === 'win32'
	? [ '%SystemDrive%', '%ProgramFiles%', '%ProgramFiles(x86)%', '%CommonProgramFiles%', '~', '%LOCALAPPDATA%/Android' ]
	: [
		'/opt',
		'/opt/local',
		'/usr',
		'/usr/local',
		'/usr/local/share', // homebrew cask installs sdk/ndk (symlinks) to /usr/local/share/android-(sdk|ndk)
		'~',
		'~/Library/Android' // Android Studio installs the NDK to ~/Library/Android/Sdk/ndk-bundle
	];

// need to find the android module and its package.json
let androidPackageJson = {};
(function findPackageJson(dir) {
	if (dir !== '/') {
		const file = path.join(dir, 'android', 'package.json');
		if (fs.existsSync(file)) {
			androidPackageJson = require(file);
		} else {
			findPackageJson(path.dirname(dir));
		}
	}
}(path.join(__dirname, '..', '..', '..')));
// allow overridding for tests
exports.androidPackageJson = function (json) {
	androidPackageJson = json;
};

/**
 * Detects current Android environment.
 * @param {Object} config - The CLI config object
 * @param {Object} opts - Detect options
 * @param {Boolean} [opts.bypassCache=false] - Bypasses the Android environment detection cache and re-queries the system
 * @param {Function} finished - Callback when detection is finished
 * @returns {void}
 */
exports.detect = function detect(config, opts, finished) {
	opts || (opts = {});

	if (envCache && !opts.bypassCache) {
		return finished(envCache);
	}

	async.parallel({
		jdk: function (next) {
			appc.jdk.detect(config, opts, function (results) {
				next(null, results);
			});
		},

		sdk: function (next) {
			var queue = async.queue(function (task, callback) {
				task(function (err, result) {
					if (err) {
						callback(); // go to next item in the queue
					} else {
						next(null, result);
					}
				});
			}, 1);

			queue.drain(function () {
				// we have completely exhausted all search paths
				next(null, null);
			});

			queue.push([
				// first let's check the config's value
				function (cb) {
					findSDK(config.get('android.sdkPath'), config, androidPackageJson, cb);
				},
				// try the environment variables
				function (cb) {
					findSDK(process.env.ANDROID_SDK_ROOT, config, androidPackageJson, cb);
				},
				function (cb) {
					findSDK(process.env.ANDROID_SDK, config, androidPackageJson, cb);
				},
				// try finding the 'adb' executable
				function (cb) {
					findExecutable([ config.get('android.executables.adb'), 'adb' + exe ], function (err, result) {
						if (err) {
							cb(err);
						} else {
							findSDK(path.resolve(result, '..', '..'), config, androidPackageJson, cb);
						}
					});
				}
			]);

			dirs.forEach(function (dir) {
				dir = afs.resolvePath(dir);
				try {
					fs.existsSync(dir) && fs.readdirSync(dir).forEach(function (name) {
						var subdir = path.join(dir, name);
						if (/android|sdk/i.test(name) && fs.existsSync(subdir) && fs.statSync(subdir).isDirectory()) {
							queue.push(function (cb) {
								findSDK(subdir, config, androidPackageJson, cb);
							});

							// this dir may be the Android SDK, but just in case,
							// let's see if there's an Android folder in this one
							fs.statSync(subdir).isDirectory() && fs.readdirSync(subdir).forEach(function (name) {
								if (/android/i.test(name)) {
									queue.push(function (cb) {
										findSDK(path.join(subdir, name), config, androidPackageJson, cb);
									});
								}
							});
						}
					});
				} catch (e) {
					// Ignore
				}
			});
		},

		ndk: function (next) {
			var queue = async.queue(function (task, callback) {
				task(function (err, result) {
					if (err) {
						callback(); // go to next item in the queue
					} else {
						next(null, result);
					}
				});
			}, 1);

			queue.drain(function () {
				// we have completely exhausted all search paths
				next(null, null);
			});

			queue.push([
				// first let's check the config's value
				function (cb) {
					findNDK(config.get('android.ndkPath'), config, cb);
				},
				// try the environment variable
				function (cb) {
					findNDK(process.env.ANDROID_NDK, config, cb);
				},
				// try finding the 'ndk-build' executable
				function (cb) {
					findExecutable([ config.get('android.executables.ndkbuild'), 'ndk-build' + cmd ], function (err, result) {
						if (err) {
							cb(err);
						} else {
							findNDK(path.dirname(result), config, cb);
						}
					});
				}
			]);

			dirs.forEach(function (dir) {
				dir = afs.resolvePath(dir);
				try {
					fs.existsSync(dir) && fs.readdirSync(dir).forEach(function (name) {
						var subdir = path.join(dir, name);
						if (/android|sdk/i.test(name)) {
							queue.push(function (cb) {
								findNDK(subdir, config, cb);
							});

							// Check under NDK side-by-side directory which contains multiple NDK installations.
							// Each subfolder is named after the version of NDK installed under it. Favor newest version.
							const ndkSideBySidePath = path.join(subdir, 'ndk');
							if (fs.existsSync(ndkSideBySidePath) && fs.statSync(ndkSideBySidePath).isDirectory()) {
								const fileNames = fs.readdirSync(ndkSideBySidePath);
								fileNames.sort(createReverseComparerFrom(versionStringComparer));
								for (const nextFileName of fileNames) {
									const nextFilePath = path.join(ndkSideBySidePath, nextFileName);
									queue.push(function (cb) {
										findNDK(nextFilePath, config, cb);
									});
								}
							}

							// Android Studio used to install under Android SDK subfolder "ndk-bundle". (Deprecated in 2019.)
							const ndkBundlePath = path.join(subdir, 'ndk-bundle');
							if (fs.existsSync(ndkBundlePath) && fs.statSync(ndkBundlePath).isDirectory()) {
								queue.push(function (cb) {
									findNDK(ndkBundlePath, config, cb);
								});
							}
						}
					});
				} catch (e) {
					// Ignore
				}
			});
		},

		linux64bit: function (next) {
			// detect if we're using a 64-bit Linux OS that's missing 32-bit libraries
			if (process.platform === 'linux' && process.arch === 'x64') {
				var result = {
					libGL: fs.existsSync('/usr/lib/libGL.so'),
					i386arch: null,
					'libc6:i386': null,
					'libncurses5:i386': null,
					'libstdc++6:i386': null,
					'zlib1g:i386': null,
					glibc: null,
					libstdcpp: null
				};
				async.parallel([
					function (cb) {
						findExecutable([ config.get('linux.dpkg'), 'dpkg' ], function (err, dpkg) {
							if (err || !dpkg) {
								return cb();
							}

							var archs = {};
							run(dpkg, '--print-architecture', function (code, stdout, stderr) {
								stdout.split('\n').forEach(function (line) {
									(line = line.trim()) && (archs[line] = 1);
								});
								run(dpkg, '--print-foreign-architectures', function (code, stdout, stderr) {
									stdout.split('\n').forEach(function (line) {
										(line = line.trim()) && (archs[line] = 1);
									});

									// now that we have the architectures, make sure we have the i386 architecture
									result.i386arch = !!archs.i386;
									cb();
								});
							});
						});
					},
					function (cb) {
						findExecutable([ config.get('linux.dpkgquery'), 'dpkg-query' ], function (err, dpkgquery) {
							if (err || !dpkgquery) {
								return cb();
							}

							async.each(
								[ 'libc6:i386', 'libncurses5:i386', 'libstdc++6:i386', 'zlib1g:i386' ],
								function (pkg, next) {
									run(dpkgquery, [ '-l', pkg ], function (code, out, err) {
										result[pkg] = false;
										if (!code) {
											var lines = out.split('\n'),
												i = 0,
												l = lines.length;
											for (; i < l; i++) {
												if (lines[i].indexOf(pkg) !== -1) {
													// we look for "ii" which means we want the "desired action"
													// to be "installed" and the "status" to be "installed"
													if (lines[i].indexOf('ii') === 0) {
														result[pkg] = true;
													}
													break;
												}
											}
										}
										next();
									});
								},
								function () {
									cb();
								}
							);
						});
					},
					function (cb) {
						findExecutable([ config.get('linux.rpm'), 'rpm' ], function (err, rpm) {
							if (err || !rpm) {
								return cb();
							}

							run(rpm, '-qa', function (code, stdout, stderr) {
								stdout.split('\n').forEach(function (line) {
									if (/^glibc-/.test(line)) {
										if (/\.i[36]86$/.test(line)) {
											result.glibc = true;
										} else if (result.glibc !== true) {
											result.glibc = false;
										}
									}
									if (/^libstdc\+\+-/.test(line)) {
										if (/\.i[36]86$/.test(line)) {
											result.libstdcpp = true;
										} else if (result.libstdcpp !== true) {
											result.libstdcpp = false;
										}
									}
								});
								cb();
							});
						});
					}
				], function () {
					next(null, result);
				});
			} else {
				next(null, null);
			}
		}

	}, function (err, results) {
		var sdkHome = process.env.ANDROID_SDK_HOME && afs.resolvePath(process.env.ANDROID_SDK_HOME),
			jdkInfo = results.jdk;

		delete results.jdk;

		results.home               = sdkHome && fs.existsSync(sdkHome) && fs.statSync(sdkHome).isDirectory() ? sdkHome : afs.resolvePath('~/.android');
		results.detectVersion      = '2.0';
		results.vendorDependencies = androidPackageJson.vendorDependencies;
		results.targets            = {};
		results.avds               = [];
		results.issues             = [];

		function finalize() {
			finished(envCache = results);
		}

		if (!jdkInfo.home) {
			results.issues.push({
				id: 'ANDROID_JDK_NOT_FOUND',
				type: 'error',
				message: __('JDK (Java Development Kit) not found.') + '\n'
					+ __('If you already have installed the JDK, verify your __JAVA_HOME__ environment variable is correctly set.') + '\n'
					+ __('The JDK can be downloaded and installed from %s.', '__http://appcelerator.com/jdk__')
			});
			results.sdk = null;
			return finalize();
		}

		if (process.platform === 'win32' && jdkInfo.home.indexOf('&') !== -1) {
			results.issues.push({
				id: 'ANDROID_JDK_PATH_CONTAINS_AMPERSANDS',
				type: 'error',
				message: __('The JDK (Java Development Kit) path must not contain ampersands (&) on Windows.') + '\n'
					+ __('Please move the JDK into a path without an ampersand and update the __JAVA_HOME__ environment variable.')
			});
			results.sdk = null;
			return finalize();
		}

		if (results.linux64bit !== null) {
			if (!results.linux64bit.libGL) {
				results.issues.push({
					id: 'ANDROID_MISSING_LIBGL',
					type: 'warning',
					message: __('Unable to locate an /usr/lib/libGL.so.') + '\n'
						+ __('Without the libGL library, the Android Emulator may not work properly.') + '\n'
						+ __('You may be able to fix it by reinstalling your graphics drivers and make sure it installs the 32-bit version.')
				});
			}

			if (results.linux64bit.i386arch === false) {
				results.issues.push({
					id: 'ANDROID_MISSING_I386_ARCH',
					type: 'warning',
					message: __('i386 architecture is not configured.') + '\n'
						+ __('To ensure you install the required 32-bit libraries, you need to register the i386 architecture with dpkg.') + '\n'
						+ __('To add the i386 architecture, run "%s".', '__sudo dpkg --add-architecture i386__')
				});
			}

			var missing32bitLibs = [];
			results.linux64bit['libc6:i386'] === false && missing32bitLibs.push('libc6:i386');
			results.linux64bit['libncurses5:i386'] === false && missing32bitLibs.push('libncurses5:i386');
			results.linux64bit['libstdc++6:i386'] === false && missing32bitLibs.push('libstdc++6:i386');
			results.linux64bit['zlib1g:i386'] === false && missing32bitLibs.push('zlib1g:i386');
			if (missing32bitLibs.length) {
				results.issues.push({
					id: 'ANDROID_MISSING_32BIT_LIBS',
					type: 'error',
					message: __('32-bit libraries is not installed.') + '\n'
						+ __('Without the 32-bit libraries, the Android SDK will not work properly.') + '\n'
						+ __('To install the required 32-bit libraries, run "%s".', '__sudo apt-get install ' + missing32bitLibs.join(' ') + '__')
				});
			}

			if (results.linux64bit.glibc === false) {
				results.issues.push({
					id: 'ANDROID_MISSING_32BIT_GLIBC',
					type: 'warning',
					message: __('32-bit glibc library is not installed.') + '\n'
						+ __('Without the 32-bit glibc library, the Android Emulator will not work properly.') + '\n'
						+ __('To install the required 32-bit glibc library, run "%s".', '__sudo yum install glibc.i686__')
				});
			}

			if (results.linux64bit.libstdcpp === false) {
				results.issues.push({
					id: 'ANDROID_MISSING_32BIT_LIBSTDCPP',
					type: 'warning',
					message: __('32-bit libstdc++ library is not installed.') + '\n'
						+ __('Without the 32-bit libstdc++ library, the Android Emulator will not work properly.') + '\n'
						+ __('To install the required 32-bit libstdc++ library, run "%s".', '__sudo yum install libstdc++.i686__')
				});
			}
		}

		if (!results.ndk) {
			results.issues.push({
				id: 'ANDROID_NDK_NOT_FOUND',
				type: 'warning',
				message: __('Unable to locate an Android NDK.') + '\n'
					+ __('Without the NDK, you will not be able to build native Android Titanium modules.') + '\n'
					+ __('If you have already downloaded and installed the Android NDK, you can tell Titanium where the Android NDK is located by running \'%s\', otherwise you can install it by running \'%s\' or manually downloading from %s.',
						'__' + commandPrefix + 'titanium config android.ndkPath /path/to/android-ndk__',
						'__' + commandPrefix + 'titanium setup android__',
						'__http://appcelerator.com/android-ndk__')
			});
		}

		// if we don't have an android sdk, then nothing else to do
		if (!results.sdk) {
			results.issues.push({
				id: 'ANDROID_SDK_NOT_FOUND',
				type: 'error',
				message: __('Unable to locate an Android SDK.') + '\n'
					+ __('If you have already downloaded and installed the Android SDK, you can tell Titanium where the Android SDK is located by running \'%s\', otherwise you can install it by running \'%s\' or manually downloading from %s.',
						'__' + commandPrefix + 'titanium config android.sdkPath /path/to/android-sdk__',
						'__' + commandPrefix + 'titanium setup android__',
						'__http://appcelerator.com/android-sdk__')
			});
			return finalize();
		}

		if (results.sdk.buildTools.tooNew === 'maybe') {
			results.issues.push({
				id: 'ANDROID_BUILD_TOOLS_TOO_NEW',
				type: 'warning',
				message: '\n' + __('Android Build Tools %s are too new and may or may not work with Titanium.', results.sdk.buildTools.version) + '\n'
					+ __('If you encounter problems, select a supported version with:') + '\n'
					+ '   __' + commandPrefix + 'ti config android.buildTools.selectedVersion ##.##.##__'
					+ __('\n where ##.##.## is a version in ') + results.sdk.buildTools.path.split('/').slice(0, -1).join('/') + __(' that is ') + results.sdk.buildTools.maxSupported
			});
		}

		if (!results.sdk.buildTools.supported) {
			results.issues.push({
				id: 'ANDROID_BUILD_TOOLS_NOT_SUPPORTED',
				type: 'error',
				message: createAndroidSdkInstallationErrorMessage(__('Android Build Tools %s are not supported by Titanium', results.sdk.buildTools.version))

			});
		}

		if (results.sdk.buildTools.notInstalled) {
			results.issues.push({
				id: 'ANDROID_BUILD_TOOLS_CONFIG_SETTING_NOT_INSTALLED',
				type: 'error',
				message: createAndroidSdkInstallationErrorMessage(__('The selected version of Android SDK Build Tools (%s) are not installed. Please either remove the setting using %s or install it', results.sdk.buildTools.version, `${commandPrefix} ti config --remove android.buildTools.selectedVersion`))
			});
		}

		// check if we're running Windows and if the sdk path contains ampersands
		if (process.platform === 'win32' && results.sdk.path.indexOf('&') !== -1) {
			results.issues.push({
				id: 'ANDROID_SDK_PATH_CONTAINS_AMPERSANDS',
				type: 'error',
				message: __('The Android SDK path must not contain ampersands (&) on Windows.') + '\n'
					+ __('Please move the Android SDK into a path without an ampersand and re-run __' + commandPrefix + 'titanium setup android__.')
			});
			results.sdk = null;
			return finalize();
		}

		// check if the sdk is missing any commands
		var missing = Object.keys(requiredSdkTools).filter(cmd => !results.sdk.executables[cmd]);
		if (missing.length && results.sdk.buildTools.supported) {
			var dummyPath = path.join(path.resolve('/'), 'path', 'to', 'android-sdk'),
				msg = '';

			if (missing.length) {
				msg += __n('Missing required Android SDK tool: %%s', 'Missing required Android SDK tools: %%s', missing.length, '__' + missing.join(', ') + '__') + '\n\n';
			}

			msg = createAndroidSdkInstallationErrorMessage(msg);

			if (missing.length) {
				msg += '\n' + __('You can also specify the exact location of these required tools by running:') + '\n';
				missing.forEach(function (m) {
					msg += '  ' + commandPrefix + 'ti config android.executables.' + m + ' "' + path.join(dummyPath, m + requiredSdkTools[m]) + '"\n';
				});
			}

			msg += '\n' + __('If you need to, run "%s" to reconfigure the Titanium Android settings.', commandPrefix + 'titanium setup android');

			results.issues.push({
				id: 'ANDROID_SDK_MISSING_PROGRAMS',
				type: 'error',
				message: msg
			});
		}

		/**
		 * Detect system images
		 */
		var systemImages = {};
		var systemImagesByPath = {};
		var systemImagesDir = path.join(results.sdk.path, 'system-images');
		if (isDir(systemImagesDir)) {
			fs.readdirSync(systemImagesDir).forEach(function (platform) {
				var platformDir = path.join(systemImagesDir, platform);
				if (isDir(platformDir)) {
					fs.readdirSync(platformDir).forEach(function (tag) {
						var tagDir = path.join(platformDir, tag);
						if (isDir(tagDir)) {
							fs.readdirSync(tagDir).forEach(function (abi) {
								var abiDir = path.join(tagDir, abi);
								var props = readProps(path.join(abiDir, 'source.properties'));
								if (props && props['AndroidVersion.ApiLevel'] && props['SystemImage.TagId'] && props['SystemImage.Abi']) {
									var id = 'android-' + (props['AndroidVersion.CodeName'] || props['AndroidVersion.ApiLevel']);
									var tag = props['SystemImage.TagId'];
									var skinsDir = path.join(abiDir, 'skins');

									systemImages[id] || (systemImages[id] = {});
									systemImages[id][tag] || (systemImages[id][tag] = []);
									systemImages[id][tag].push({
										abi: props['SystemImage.Abi'],
										skins: isDir(skinsDir) ? fs.readdirSync(skinsDir).map(name => {
											return isFile(path.join(skinsDir, name, 'hardware.ini')) ? name : null;
										}).filter(x => x) : []
									});

									systemImagesByPath[path.relative(results.sdk.path, abiDir)] = {
										id: id,
										tag: tag,
										abi: abi
									};
								}
							});
						}
					});
				}
			});
		}

		/**
		 * Detect targets
		 */
		var platformsDir = path.join(results.sdk.path, 'platforms');
		var platforms = [];
		var platformsById = {};
		if (isDir(platformsDir)) {
			fs.readdirSync(platformsDir).forEach(function (name) {
				var info = loadPlatform(path.join(platformsDir, name), systemImages);
				if (info) {
					platforms.push(info);
					platformsById[info.id] = info;
				}
			});
		}

		var addonsDir = path.join(results.sdk.path, 'add-ons');
		var addons = [];
		if (isDir(addonsDir)) {
			fs.readdirSync(addonsDir).forEach(function (name) {
				var info = loadAddon(path.join(addonsDir, name), platforms, systemImages);
				info && addons.push(info);
			});
		}

		function sortFn(a, b) {
			if (a.codename === null) {
				if (b.codename !== null && a.apiLevel === b.apiLevel) {
					// sort GA releases before preview releases
					return -1;
				}
			} else if (a.apiLevel === b.apiLevel) {
				return b.codename === null ? 1 : a.codename.localeCompare(b.codename);
			}

			return a.apiLevel - b.apiLevel;
		}

		var index = 1;
		platforms.sort(sortFn).concat(addons.sort(sortFn)).forEach(function (platform) {
			var abis = [];
			if (platform.abis) {
				Object.keys(platform.abis).forEach(function (type) {
					platform.abis[type].forEach(function (abi) {
						if (abis.indexOf(abi) === -1) {
							abis.push(abi);
						}
					});
				});
			}

			var info = {
				id:          platform.id,
				abis:        abis,
				skins:       platform.skins,
				name:        platform.name,
				type:        platform.type,
				path:        platform.path,
				revision:    platform.revision,
				androidJar:  platform.androidJar,
				aidl:        platform.aidl
			};

			if (platform.type === 'platform') {
				info['api-level'] = platform.apiLevel;
				info.sdk = platform.apiLevel;
				info.version = platform.version;
				info.supported = !~~platform.apiLevel || appc.version.satisfies(platform.apiLevel, androidPackageJson.vendorDependencies['android sdk'], true);
			} else if (platform.type === 'add-on' && platform.basedOn) {
				info.vendor = platform.vendor;
				info.description = platform.description;
				info.version = platform.basedOn.version || parseInt(String(platform.basedOn).replace(/^android-/, '')) || null;
				info['based-on'] = {
					'android-version': platform.basedOn.version,
					'api-level': platform.basedOn.apiLevel
				};
				info.supported = !~~platform.basedOn.apiLevel || appc.version.satisfies(platform.basedOn.apiLevel, androidPackageJson.vendorDependencies['android sdk'], true);
				info.libraries = {}; // not supported any more
			}

			results.targets[index++] = info;

			if (!info.supported) {
				results.issues.push({
					id: 'ANDROID_API_TOO_OLD',
					type: 'warning',
					message: __('Android API %s is too old and is no longer supported by Titanium SDK %s.', '__' + info.name + ' (' + info.id + ')__', manifestJson.version) + '\n'
						+ __('The minimum supported Android API level by Titanium SDK %s is API level %s.', manifestJson.version, appc.version.parseMin(androidPackageJson.vendorDependencies['android sdk']))
				});
			} else if (info.supported === 'maybe') {
				results.issues.push({
					id: 'ANDROID_API_TOO_NEW',
					type: 'warning',
					message: __('Android API %s is too new and may or may not work with Titanium SDK %s.', '__' + info.name + ' (' + info.id + ')__', manifestJson.version) + '\n'
						+ __('The maximum supported Android API level by Titanium SDK %s is API level %s.', manifestJson.version, appc.version.parseMax(androidPackageJson.vendorDependencies['android sdk']))
				});
			}
		});

		// check that we found at least one target
		if (!Object.keys(results.targets).length) {
			results.issues.push({
				id: 'ANDROID_NO_APIS',
				type: 'error',
				message: __('No Android APIs found.') + '\n'
					+ __('Run \'%s\' to install the latest Android APIs.', 'Android Studio')
			});
		}

		// check that we found at least one valid target
		if (!Object.keys(results.targets).some(t => !!results.targets[t].supported)) {
			results.issues.push({
				id: 'ANDROID_NO_VALID_APIS',
				type: 'warning',
				message: __('No valid Android APIs found that are supported by Titanium SDK %s.', manifestJson.version) + '\n'
					+ __('Run \'%s\' to install the latest Android APIs.', 'Android Studio')
			});
		}

		// parse the avds
		var avdDir = afs.resolvePath('~/.android/avd');
		var iniRegExp = /^(.+)\.ini$/;
		if (isDir(avdDir)) {
			fs.readdirSync(avdDir).forEach(function (name) {
				var m = name.match(iniRegExp);
				if (!m) {
					return;
				}

				var ini = readProps(path.join(avdDir, name));
				if (!ini) {
					return;
				}

				var q;
				var p = isDir(ini.path) ? ini.path : (ini['path.rel'] && isDir(q = path.join(avdDir, ini['path.rel'])) ? q : null);
				if (!p) {
					return;
				}

				var config = readProps(path.join(p, 'config.ini'));
				if (!config) {
					return;
				}

				var sdcard = path.join(p, 'sdcard.img');
				var target = null;
				var sdk = null;
				var apiLevel = null;

				var info = config['image.sysdir.1'] && systemImagesByPath[config['image.sysdir.1'].replace(/\/$/, '')];
				if (info) {
					var platform = platformsById[info.id];
					if (platform) {
						target = platform.name + ' (API level ' + platform.apiLevel + ')';
						sdk = platform.version;
						apiLevel = platform.apiLevel;
					}
				}

				results.avds.push({
					type:          'avd',
					id:            config['AvdId'] || m[1],
					name:          config['avd.ini.displayname'] || m[1],
					device:        config['hw.device.name'] + ' (' + config['hw.device.manufacturer'] + ')',
					path:          p,
					target:        target,
					abi:           config['abi.type'],
					skin:          config['skin.name'],
					sdcard:        config['hw.sdCard'] === 'yes' && isFile(sdcard) ? sdcard : null,
					googleApis:    config['tag.id'] === 'google_apis',
					'sdk-version': sdk,
					'api-level':   apiLevel
				});
			});
		}

		finalize();

		function createAndroidSdkInstallationErrorMessage(message) {
			if (!message) {
				message = '';
			} else if (message.length > 0) {
				message += '\n';
			}
			message +=
				__('Current installed Android SDK tools:') + '\n'
				+ '  Android SDK Tools:          ' + (results.sdk.tools.version || 'not installed') + '  (Supported: ' + androidPackageJson.vendorDependencies['android tools'] + ')\n'
				+ '  Android SDK Platform Tools: ' + (results.sdk.platformTools.version || 'not installed') + '  (Supported: ' + androidPackageJson.vendorDependencies['android platform tools'] + ')\n'
				+ '  Android SDK Build Tools:    ' + (results.sdk.buildTools.version || 'not installed') + '  (Supported: ' + androidPackageJson.vendorDependencies['android build tools'] + ')\n\n'
				+ __('Make sure you have the latest Android SDK Tools, Platform Tools, and Build Tools installed.') + '\n';
			return message;
		}
	});
};

exports.findSDK = findSDK;

function findSDK(dir, config, androidPackageJson, callback) {
	if (!dir) {
		return callback(true);
	}

	dir = afs.resolvePath(dir);

	// check if the supplied directory exists and is actually a directory
	if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
		return callback(true);
	}

	const dxJarPath = path.join(dir, 'platform-tools', 'lib', 'dx.jar'),
		proguardPath = path.join(dir, 'tools', 'proguard', 'lib', 'proguard.jar'),
		emulatorPath = path.join(dir, 'emulator', 'emulator' + exe),
		result = {
			path: dir,
			executables: {
				adb:       path.join(dir, 'platform-tools', 'adb' + exe),
				android:   null, // this tool has been deprecated
				emulator:  fs.existsSync(emulatorPath) ? emulatorPath : path.join(dir, 'tools', 'emulator' + exe),
				mksdcard:  path.join(dir, 'tools', 'mksdcard' + exe),
				zipalign:  path.join(dir, 'tools', 'zipalign' + exe),
				// Android SDK Tools v21 and older puts aapt and aidl in the platform-tools dir.
				// For SDK Tools v22 and later, they live in the build-tools/<ver> directory.
				aapt:      path.join(dir, 'platform-tools', 'aapt' + exe),
				aidl:      path.join(dir, 'platform-tools', 'aidl' + exe),
				dx:        path.join(dir, 'platform-tools', 'dx' + bat),
				apksigner: null
			},
			dx: fs.existsSync(dxJarPath) ? dxJarPath : null,
			proguard: fs.existsSync(proguardPath) ? proguardPath : null,
			tools: {
				path: null,
				supported: null,
				version: null
			},
			platformTools: {
				path: null,
				supported: null,
				version: null
			},
			buildTools: {
				path: null,
				supported: null,
				version: null,
				tooNew: null,
				maxSupported: null
			}
		},
		tasks = {},
		buildToolsDir = path.join(dir, 'build-tools');

	/*
		Determine build tools version to use based on either config setting
		(android.buildTools.selectedVersion) or latest version
	*/
	let buildToolsSupported = false;
	if (fs.existsSync(buildToolsDir)) {
		let ver = config.get('android.buildTools.selectedVersion');
		if (!ver) {
			// No selected version, so find the newest, supported build tools version
			const ignoreDirs = new RegExp(config.get('cli.ignoreDirs'));
			const ignoreFiles = new RegExp(config.get('cli.ignoreFiles'));
			const files = fs.readdirSync(buildToolsDir).sort().reverse().filter(item => !(ignoreFiles.test(item) || ignoreDirs.test(item)));
			const len = files.length;
			let i = 0;
			for (; i < len; i++) {
				var isSupported = appc.version.satisfies(files[i], androidPackageJson.vendorDependencies['android build tools'], true);
				if (isSupported) {
					buildToolsSupported = isSupported;
					ver = files[i];
					if (buildToolsSupported === true) {
						// The version found is fully supported (not set to 'maybe'). So, stop here.
						break;
					}
				}
			}

			// If we've failed to find a build-tools version that Titanium supports up above,
			// then grab the newest old version installed to be logged as unsupported later.
			if (!ver && (len > 0)) {
				ver = files[len - 1];
				buildToolsSupported = false;
			}
		}
		if (ver) {
			// A selectedVersion specified or supported version has been found
			let file = path.join(buildToolsDir, ver, 'source.properties');
			if (fs.existsSync(file) && fs.statSync(path.join(buildToolsDir, ver)).isDirectory()) {
				var m = fs.readFileSync(file).toString().match(/Pkg\.Revision\s*?=\s*?([^\s]+)/);
				if (m) {
					result.buildTools = {
						path: path.join(buildToolsDir, ver),
						supported: appc.version.satisfies(m[1], androidPackageJson.vendorDependencies['android build tools'], true),
						version: m[1],
						tooNew: buildToolsSupported,
						maxSupported: appc.version.parseMax(androidPackageJson.vendorDependencies['android build tools'], true)
					};
					fs.existsSync(file = path.join(buildToolsDir, ver, 'aapt' + exe)) && (result.executables.aapt = file);
					fs.existsSync(file = path.join(buildToolsDir, ver, 'aidl' + exe)) && (result.executables.aidl = file);
					fs.existsSync(file = path.join(buildToolsDir, ver, 'apksigner' + bat)) && (result.executables.apksigner = file);
					fs.existsSync(file = path.join(buildToolsDir, ver, 'dx' + bat)) && (result.executables.dx = file);
					fs.existsSync(file = path.join(buildToolsDir, ver, 'lib', 'dx.jar')) && (result.dx = file);
					fs.existsSync(file = path.join(buildToolsDir, ver, 'zipalign' + exe)) && (result.executables.zipalign = file);
				}
			} else {
				// build tools don't exist at the given location
				result.buildTools = {
					path: path.join(buildToolsDir, ver),
					notInstalled: true,
					version: ver
				};
			}
		}
	}

	// see if this sdk has all the executables we need
	Object.keys(requiredSdkTools).forEach(function (cmd) {
		tasks[cmd] = function (next) {
			findExecutable([
				config.get('android.executables.' + cmd),
				result.executables[cmd]
			], function (err, r) {
				next(null, !err && r ? r : null);
			});
		};
	});

	async.parallel(tasks, function (err, executables) {
		appc.util.mix(result.executables, executables);

		// check that we have all required sdk programs
		if (Object.keys(requiredSdkTools).every(cmd => !executables[cmd])) {
			return callback(true);
		}

		var file = path.join(dir, 'tools', 'source.properties');

		// check if this directory contains an android sdk
		if (!fs.existsSync(executables.adb) || !fs.existsSync(file)) {
			return callback(true);
		}

		// looks like we found an android sdk, check what version
		if (fs.existsSync(file)) {
			const m = fs.readFileSync(file).toString().match(/Pkg\.Revision\s*?=\s*?([^\s]+)/);
			if (m) {
				result.tools = {
					path: path.join(dir, 'tools'),
					supported: appc.version.satisfies(m[1], androidPackageJson.vendorDependencies['android tools'], true),
					version: m[1]
				};
			}
		}

		file = path.join(dir, 'platform-tools', 'source.properties');
		if (fs.existsSync(file)) {
			const m = fs.readFileSync(file).toString().match(/Pkg\.Revision\s*?=\s*?([^\s]+)/);
			if (m) {
				result.platformTools = {
					path: path.join(dir, 'platform-tools'),
					supported: appc.version.satisfies(m[1], androidPackageJson.vendorDependencies['android platform tools'], true),
					version: m[1]
				};
			}
		}

		callback(null, result);
	});
}

function findNDK(dir, config, callback) {
	if (!dir) {
		return callback(true);
	}

	// check if the supplied directory exists and is actually a directory
	dir = afs.resolvePath(dir);

	if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
		return callback(true);
	}

	// check that the ndk files/folders exist
	const things = [ 'ndk-build' + cmd, 'build', 'prebuilt', 'platforms' ];
	if (!things.every(thing => fs.existsSync(path.join(dir, thing)))) {
		return callback(true);
	}

	// try to determine the version
	let version;
	const sourceProps = path.join(dir, 'source.properties');
	if (fs.existsSync(sourceProps)) {
		const m = fs.readFileSync(sourceProps).toString().match(/Pkg\.Revision\s*=\s*(.+)/m);
		if (m && m[1]) {
			version = m[1].trim();
		}
	}

	if (!version) {
		// try the release.txt
		let releasetxt;
		fs.readdirSync(dir).some(function (file) {
			if (file.toLowerCase() === 'release.txt') {
				releasetxt = path.join(dir, file);
				return true;
			}
			return false;
		});

		if (releasetxt && fs.existsSync(releasetxt)) {
			version = fs.readFileSync(releasetxt).toString().split(/\r?\n/).shift().trim();
		}
	}

	if (!version) {
		// no version, not an ndk
		return callback(true);
	}

	callback(null, {
		path: dir,
		executables: {
			ndkbuild: path.join(dir, 'ndk-build' + cmd)
		},
		version: version
	});
}

function isDir(dir) {
	try {
		return fs.statSync(dir).isDirectory();
	} catch (e) {
		// squeltch
	}
	return false;
}

function isFile(file) {
	try {
		return fs.statSync(file).isFile();
	} catch (e) {
		// squeltch
	}
	return false;
}

function readProps(file) {
	if (!isFile(file)) {
		return null;
	}

	const props = {};
	fs.readFileSync(file).toString().split(/\r?\n/).forEach(function (line) {
		const m = line.match(pkgPropRegExp);
		if (m) {
			props[m[1].trim()] = m[2].trim();
		}
	});

	return props;
}

function loadPlatform(dir, systemImages) {
	// read in the properties
	const sourceProps = readProps(path.join(dir, 'source.properties'));
	const apiLevel = sourceProps ? ~~sourceProps['AndroidVersion.ApiLevel'] : null;
	if (!sourceProps || !apiLevel || !isFile(path.join(dir, 'build.prop'))) {
		return null;
	}

	// read in the sdk properties, if exists
	const sdkProps = readProps(path.join(dir, 'sdk.properties'));

	// detect the available skins
	const skinsDir = path.join(dir, 'skins');
	const skins = isDir(skinsDir) ? fs.readdirSync(skinsDir).map(name => {
		return isFile(path.join(skinsDir, name, 'hardware.ini')) ? name : null;
	}).filter(x => x) : [];
	let defaultSkin = sdkProps && sdkProps['sdk.skin.default'];
	if (skins.indexOf(defaultSkin) === -1 && skins.indexOf(defaultSkin = 'WVGA800') === -1) {
		defaultSkin = skins[skins.length - 1] || null;
	}

	const apiName = sourceProps['AndroidVersion.CodeName'] || apiLevel;
	const id = `android-${apiName}`;

	const abis = {};
	if (systemImages[id]) {
		Object.keys(systemImages[id]).forEach(function (type) {
			systemImages[id][type].forEach(function (info) {
				abis[type] || (abis[type] = []);
				abis[type].push(info.abi);

				info.skins.forEach(function (skin) {
					if (skins.indexOf(skin) === -1) {
						skins.push(skin);
					}
				});
			});
		});
	}

	let tmp;
	return {
		id:          id,
		name:        'Android ' + sourceProps['Platform.Version'] + (sourceProps['AndroidVersion.CodeName'] ? ' (Preview)' : ''),
		type:        'platform',
		apiLevel:    apiLevel,
		codename:    sourceProps['AndroidVersion.CodeName'] || null,
		revision:    +sourceProps['Layoutlib.Revision'] || null,
		path:        dir,
		version:     sourceProps['Platform.Version'],
		abis:        abis,
		skins:       skins,
		defaultSkin: defaultSkin,
		minToolsRev: +sourceProps['Platform.MinToolsRev'] || null,
		androidJar:  isFile(tmp = path.join(dir, 'android.jar')) ? tmp : null,
		aidl:        isFile(tmp = path.join(dir, 'framework.aidl')) ? tmp : null
	};
}

function loadAddon(dir, platforms, systemImages) {
	// read in the properties
	const sourceProps = readProps(path.join(dir, 'source.properties'));
	const apiLevel = sourceProps ? ~~sourceProps['AndroidVersion.ApiLevel'] : null;
	if (!sourceProps || !apiLevel || !sourceProps['Addon.VendorDisplay'] || !sourceProps['Addon.NameDisplay']) {
		return null;
	}

	const basedOn = platforms.find(p => p.codename === null && p.apiLevel === apiLevel);

	return {
		id:          sourceProps['Addon.VendorDisplay'] + ':' + sourceProps['Addon.NameDisplay'] + ':' + apiLevel,
		name:        sourceProps['Addon.NameDisplay'],
		type:        'add-on',
		vendor:      sourceProps['Addon.VendorDisplay'],
		description: sourceProps['Pkg.Desc'],
		apiLevel:    apiLevel,
		revision:    +sourceProps['Pkg.Revision'] || null,
		codename:    sourceProps['AndroidVersion.CodeName'] || null,
		path:        dir,
		basedOn:     basedOn ? {
			version: basedOn.version,
			apiLevel: basedOn.apiLevel
		} : null,
		abis:        basedOn && basedOn.abis || null,
		skins:       basedOn && basedOn.skins || null,
		defaultSkin: basedOn && basedOn.defaultSkin || null,
		minToolsRev: basedOn && basedOn.minToolsRev || null,
		androidJar:  basedOn && basedOn.androidJar || null,
		aidl:        basedOn && basedOn.aidl || null
	};
}

function createReverseComparerFrom(compareFunction) {
	// If argument is not a function, then return it as-is. Especially if it's null or undefined.
	if (typeof compareFunction !== 'function') {
		return compareFunction;
	}

	// Wrap given comparer with a new function which flips the result.
	return function (element1, element2) {
		return compareFunction(element1, element2) * (-1);
	};
}

function versionStringComparer(element1, element2) {
	// Check if the references match. (This is an optimization.)
	// eslint-disable-next-line eqeqeq
	if (element1 == element2) {
		return 0;
	}

	// Compare element types. String types are always greater than non-string types.
	const isElement1String = (typeof element1 === 'string');
	const isElement2String = (typeof element2 === 'string');
	if (isElement1String && !isElement2String) {
		return 1;
	} else if (!isElement1String && isElement2String) {
		return -1;
	} else if (!isElement1String && !isElement2String) {
		return 0;
	}

	// Split version strings into components. Example: '1.2.3' -> ['1', '2', '3']
	// If there is version component length mismatch, then pad the rest with zeros.
	const version1Components = element1.split('.');
	const version2Components = element2.split('.');
	const componentLengthDelta = version1Components.length - version2Components.length;
	if (componentLengthDelta > 0) {
		version2Components.push(...Array(componentLengthDelta).fill('0'));
	} else if (componentLengthDelta < 0) {
		version1Components.push(...Array(-componentLengthDelta).fill('0'));
	}

	// Compare the 2 given version strings by their numeric components.
	for (let index = 0; index < version1Components.length; index++) {
		let value1 = Number.parseInt(version1Components[index], 10);
		if (Number.isNaN(value1)) {
			value1 = 0;
		}
		let value2 = Number.parseInt(version2Components[index], 10);
		if (Number.isNaN(value2)) {
			value2 = 0;
		}
		const valueDelta = value1 - value2;
		if (valueDelta !== 0) {
			return valueDelta;
		}
	}
	return 0;
}
