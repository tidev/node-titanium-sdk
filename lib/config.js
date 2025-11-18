export const defaultConfig = {
	android: {
		adb: {
			install: {
				/**
				 * The number of milliseconds to wait before installing an app times out.
				 * @type {Number}
				 */
				timeout: null
			},

			/**
			 * The path to the ADB executable.
			 * @type {String}
			 */
			path: null,

			/**
			 * The port to connect to ADB.
			 * @type {Number}
			 */
			port: null,

			/**
			 * The options to start ADB.
			 * @type {Object}
			 */
			start: {
				/**
				 * The number of milliseconds to wait before retrying to start ADB.
				 * @type {Number}
				 */
				retryInterval: null,

				/**
				 * The number of milliseconds to wait before starting ADB times out.
				 * @type {Number}
				 */
				timeout: null
			}
		},
		avd: {
			/**
			 * The path to where AVDs are stored.
			 * @type {String}
			 */
			path: '~/.android/avd'
		},
		emulator: {
			start: {
				/**
				 * The number of milliseconds to wait before starting the Android emulator times out.
				 * @type {Number}
				 */
				timeout: null
			}
		},
		ndk: {
			/**
			 * A list of paths to search for Android NDKs.
			 * @type {String[]|Object}
			 */
			searchPaths: {
				darwin: [
					'~/Library/Android/sdk/ndk',
					'~/Library/Android/sdk/ndk-bundle'
				],
				linux: [
					'~/Android/sdk/ndk',
					'~/Android/sdk/ndk-bundle'
				],
				win32: [
					'%LOCALAPPDATA%\\Android\\sdk\\ndk',
					'%LOCALAPPDATA%\\Android\\sdk\\ndk-bundle'
				]
			}
		},
		sdk: {
			/**
			 * A list of paths to search for Android SDKs.
			 * @type {String[]|Object}
			 */
			searchPaths: {
				darwin: [
					'~/Library/Android/sdk',
					'/usr/local/share'
				],
				linux: [
					'~/Android/sdk',
					'/usr/local/share'
				],
				win32: [
					'%LOCALAPPDATA%\\Android\\sdk'
				]
			}
		}
	},

	env: {
		/**
		 * An override for the `PATH` environment variable.
		 * @type {String}
		 */
		path: null
	},

	ios: {
		executables: {
			/**
			 * Path to the `security` executable.
			 * @type {String}
			 */
			security: null,

			sqlite: {
				/**
				 * Path to the `sqlite` or `sqlite3` executable. Used to read the Xcode teams database.
				 * @type {String}
				 */
				path: null
			},

			/**
			 * Path to the `xcode-select` executable.
			 * @type {String}
			 */
			xcodeSelect: null
		},

		keychainMetaFile: '~/Library/Preferences/com.apple.security.plist',

		provisioning: {
			/**
			 * A list of paths to search for provisioning profiles.
			 * @type {String[]}
			 */
			searchPaths: [
				'~/Library/Developer/Xcode/UserData/Provisioning Profiles',
				'~/Library/MobileDevice/Provisioning Profiles'
			]
		},

		simulator: {
			/**
			 * The path to the directory containing the simulator crash logs.
			 * @type {String}
			 */
			crashLogsDir: '~/Library/Logs/DiagnosticReports',

			/**
			 * The path to the directory containing the simulator device directories.
			 * @type {String}
			 */
			devicesDir: '~/Library/Developer/CoreSimulator/Devices',

			/**
			 * The path to the directory containing the simulator runtimes.
			 * @type {String}
			 */
			runtimesDir: '/Library/Developer/CoreSimulator/Profiles/Runtimes'
		},

		xcode: {
			/**
			 * A list of paths to search for Xcode installations.
			 * @type {String[]}
			 */
			searchPaths: [
				'/Applications',
				'~/Applications'
			]
		}
	},

	jdk: {
		/**
		 * A list of paths to search for JDKs.
		 * @type {String[]|Object}
		 */
		searchPaths: {
			darwin: [
				'/Library/Java/JavaVirtualMachines',
				'/System/Library/Java/JavaVirtualMachines'
			],
			linux: [
				'/usr/lib/jvm'
			]
			// note: for Windows, we check the Windows Registry
		},

		windows: {
			/**
			 * The registry keys to search for JDKs.
			 * @type {String[]}
			 */
			registryKeys: [
				'HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit',
				'HKLM\\SOFTWARE\\Wow6432Node\\JavaSoft\\Java Development Kit',
				'HKLM\\SOFTWARE\\JavaSoft\\JDK'
			]
		}
	},

	network: {
		/**
		 * The options to pass to the `http.Agent` constructor.
		 * @type {Object}
		 */
		agentOptions: null,

		/**
		 * The path to the CA file.
		 * @type {String}
		 */
		caFile: null,

		/**
		 * The path to the certificate file.
		 * @type {String}
		 */
		certFile: null,

		/**
		 * The HTTP proxy to use.
		 * @type {String}
		 */
		httpProxy: null,

		/**
		 * The HTTPS proxy to use.
		 * @type {String}
		 */
		httpsProxy: null,

		/**
		 * The path to the key file.
		 * @type {String}
		 */
		keyFile: null,

		/**
		 * The passphrase to use.
		 * @type {String}
		 */
		passphrase: null,

		/**
		 * Whether to use strict SSL.
		 * @type {Boolean}
		 */
		strictSSL: true
	},

	titanium: {
		modules: {
			/**
			 * A list of paths to search for Titanium modules.
			 * @type {String[]|Object}
			 */
			searchPaths: {
				darwin: [
					'~/Library/Application Support/Titanium',
					'/Library/Application Support/Titanium' // legacy
				],
				linux: [
					'~/.titanium'
				],
				win32: [
					'%ProgramData%\\Titanium',
					'%APPDATA%\\Titanium',
					'%ALLUSERSPROFILE%\\Application Data\\Titanium'
				]
			}
		},

		sdk: {
			downloadURLs: {
				branches:     'https://downloads.titaniumsdk.com/registry/branches.json',
				branchBuilds: 'https://downloads.titaniumsdk.com/registry/${branch}.json',
				releases: {
					beta:     'https://downloads.titaniumsdk.com/registry/beta.json',
					rc:       'https://downloads.titaniumsdk.com/registry/rc.json',
					ga:       'https://downloads.titaniumsdk.com/registry/ga.json'
				}
			},

			installPath: {
				darwin: '~/Library/Application Support/Titanium',
				linux: '~/.titanium',
				win32: '%ProgramData%\\Titanium'
			},

			/**
			* A list of paths to search for Titanium SDKs.
			* @type {String[]|Object}
			*/
			searchPaths: {
				darwin: [
					'~/Library/Application Support/Titanium',
					'/Library/Application Support/Titanium' // legacy
				],
				linux: [
					'~/.titanium'
				],
				win32: [
					'%ProgramData%\\Titanium',
					'%APPDATA%\\Titanium',
					'%ALLUSERSPROFILE%\\Application Data\\Titanium'
				]
			}
		}
	}
};
