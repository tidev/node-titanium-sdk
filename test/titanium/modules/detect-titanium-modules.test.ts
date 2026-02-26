import { config, resetConfig } from '../../../src/config.js';
import { detectTitaniumModules } from '../../../src/titanium/index.js';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('detectTitaniumModules', () => {
	afterEach(() => resetConfig());

	it('should detect Titanium modules', async () => {
		config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'good');
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules();
		expect(modules).toEqual({
			android: {
				'com.test.module': {
					'1.0.0': {
						apiversion: 4,
						architectures: ['arm64-v8a', 'armeabi-v7a', 'x86'],
						author: 'Your Name',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'testModule',
						guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
						license: 'Specify your license',
						minsdk: '7.2.0',
						moduleid: 'com.test.module',
						name: 'testModule',
						path: join(__dirname, 'mocks', 'good', 'modules', 'android', 'test-module', '1.0.0'),
						platform: 'android',
						version: '1.0.0',
					},
				},
			},
			commonjs: {
				'com.test.module': {
					'1.0': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Your Name',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'testModule',
						guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
						license: 'Specify your license',
						minsdk: '7.2.0',
						moduleid: 'com.test.module',
						name: 'testModule',
						path: join(
							__dirname,
							'mocks',
							'good',
							'modules',
							'commonjs',
							'invalid-version',
							'1.0.1'
						),
						platform: 'commonjs',
						version: '1.0',
					},
					'1.0.0': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Your Name',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'testModule',
						guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
						license: 'Specify your license',
						minsdk: '7.2.0',
						moduleid: 'com.test.module',
						name: 'testModule',
						path: join(__dirname, 'mocks', 'good', 'modules', 'commonjs', 'test-module', '1.0.0'),
						platform: 'commonjs',
						version: '1.0.0',
					},
				},
			},
			ios: {
				'com.test.module': {
					'1.0.0': {
						apiversion: 2,
						architectures: ['armv7', 'arm64', 'i386', 'x86_64'],
						author: 'Your Name',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'testModule',
						guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
						license: 'Specify your license',
						minsdk: '7.2.0',
						moduleid: 'com.test.module',
						name: 'testModule',
						path: join(__dirname, 'mocks', 'good', 'modules', 'iphone', 'test-module', '1.0.0'),
						platform: 'ios',
						version: '1.0.0',
					},
				},
			},
		});
	});

	it('should detect modules with Android only', async () => {
		config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'android-only');
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules();
		expect(modules).toEqual({
			android: {
				'ti.map': {
					'3.1.0': {
						apiversion: 2,
						architectures: ['arm64-v8a', 'armeabi-v7a', 'x86'],
						author: 'Tester',
						copyright: 'Copyright (c) 2026 by Your Company',
						description: 'External version of Map module',
						guid: 'fee93b77-8eb3-418c-8f04-013664c4af83',
						license: 'Apache Public License v2',
						minsdk: '6.2.2.GA',
						moduleid: 'ti.map',
						name: 'map',
						path: join(__dirname, 'mocks', 'android-only', 'modules', 'android', 'ti.map', '3.1.0'),
						platform: 'android',
						version: '3.1.0',
					},
				},
			},
		});
	});

	it('should detect modules with CommonJS and iOS', async () => {
		config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'commonjs-ios');
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules();
		expect(modules).toEqual({
			commonjs: {
				'ti.ambiguous': {
					'1.0': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Tester',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'This is an ambiguous module that will conflict with a native module',
						guid: '8d99922e-7727-4f64-90b9-325992eddb1c',
						license: 'Apache Public License',
						minsdk: '3.0',
						moduleid: 'ti.ambiguous',
						name: 'ambiguous',
						path: join(
							__dirname,
							'mocks',
							'commonjs-ios',
							'modules',
							'commonjs',
							'ambiguous',
							'1.0'
						),
						platform: 'commonjs',
						version: '1.0',
					},
				},
			},
			ios: {
				baz: {
					'1.0': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Tester',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'This is an ambiguous module that will conflict with a commonjs module',
						guid: '8d99922e-7727-4f64-90b9-325992eddb1c',
						license: 'Apache Public License',
						minsdk: '3.0',
						moduleid: 'baz',
						name: 'baz',
						path: join(__dirname, 'mocks', 'commonjs-ios', 'modules', 'ios', 'baz', '2.0.1'),
						platform: 'ios',
						version: '1.0',
					},
				},
				'ti.ambiguous': {
					'1.0': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Tester',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'This is an ambiguous module that will conflict with a commonjs module',
						guid: '8d99922e-7727-4f64-90b9-325992eddb1c',
						license: 'Apache Public License',
						minsdk: '3.0',
						moduleid: 'ti.ambiguous',
						name: 'ambiguous',
						path: join(__dirname, 'mocks', 'commonjs-ios', 'modules', 'ios', 'ambiguous', '1.0'),
						platform: 'ios',
						version: '1.0',
					},
				},
				'ti.toonew': {
					'1.0': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Tester',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'This is a dummy module',
						guid: '8d99922e-7727-4f64-90b9-325992eddb1b',
						license: 'Apache Public License',
						minsdk: '999.0',
						moduleid: 'ti.toonew',
						name: 'toonew',
						path: join(__dirname, 'mocks', 'commonjs-ios', 'modules', 'ios', 'toonew', '1.0'),
						platform: 'ios',
						version: '1.0',
					},
				},
			},
		});
	});

	it('should detect modules with CommonJS only', async () => {
		config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'commonjs-only');
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules();
		expect(modules).toEqual({
			commonjs: {
				'ti.latestvalid': {
					'1.0': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Tester',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'This is an ambiguous module that will conflict with a native module',
						guid: '8d99922e-7727-4f64-90b9-325992eddb1c',
						license: 'Apache Public License',
						minsdk: '3.0',
						moduleid: 'ti.latestvalid',
						name: 'latestvalid',
						path: join(
							__dirname,
							'mocks',
							'commonjs-only',
							'modules',
							'commonjs',
							'latestvalid',
							'1.0'
						),
						platform: 'commonjs',
						version: '1.0',
					},
					'1.1': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Tester',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'This is an ambiguous module that will conflict with a native module',
						guid: '8d99922e-7727-4f64-90b9-325992eddb1c',
						license: 'Apache Public License',
						minsdk: '3.6',
						moduleid: 'ti.latestvalid',
						name: 'latestvalid',
						path: join(
							__dirname,
							'mocks',
							'commonjs-only',
							'modules',
							'commonjs',
							'latestvalid',
							'1.1'
						),
						platform: 'commonjs',
						version: '1.1',
					},
				},
			},
		});
	});

	it('should detect modules with iOS only', async () => {
		config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'ios-only');
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules();
		expect(modules).toEqual({
			ios: {
				'ti.ambiguous': {
					'1.0': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Tester',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'This is an ambiguous module that will conflict with a commonjs module',
						guid: '8d99922e-7727-4f64-90b9-325992eddb1c',
						license: 'Apache Public License',
						minsdk: '3.0',
						moduleid: 'ti.ambiguous',
						name: 'ambiguous',
						path: join(__dirname, 'mocks', 'ios-only', 'modules', 'ios', 'baz', '2.0.1'),
						platform: 'ios',
						version: '1.0',
					},
				},
			},
		});
	});

	it('should detect modules with iPhone only', async () => {
		config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'iphone-only');
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules();
		expect(modules).toEqual({
			ios: {
				'ti.map': {
					'3.1.0': {
						apiversion: 2,
						architectures: ['armv7', 'arm64', 'i386', 'x86_64'],
						author: 'Tester',
						copyright: 'Copyright (c) 2018 by Your Company',
						description: 'External version of Map module',
						guid: 'fee93b77-8eb3-418c-8f04-013664c4af83',
						license: 'Apache Public License v2',
						minsdk: '6.2.2.GA',
						moduleid: 'ti.map',
						name: 'map',
						path: join(__dirname, 'mocks', 'iphone-only', 'modules', 'iphone', 'ti.map', '3.1.0'),
						platform: 'ios',
						version: '3.1.0',
					},
				},
			},
		});
	});

	it('should detect nothing in empty directory', async () => {
		config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'empty');
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules();
		expect(modules).toEqual({});
	});

	it('should detect nothing in non-existent directory', async () => {
		config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'does-not-exist');
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules();
		expect(modules).toEqual({});
	});

	it('should detect cross-platform Android and iOS in node_modules', async () => {
		config.titanium.sdk.installPath[process.platform] = undefined;
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules({
			searchPaths: [join(__dirname, 'mocks', 'cross-platform-native-module')],
		});
		expect(modules).toEqual({
			android: {
				'cross-platform': {
					'2.0.1': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Tester',
						copyright: 'Copyright (c) 2026 by Your Company',
						description: 'Pretend Cross Platform Native Module for Titanium SDK',
						guid: 'bba89061-0fdb-4ff1-95a8-02876f5601f9',
						license: 'Apache',
						minsdk: undefined,
						moduleid: 'cross-platform',
						name: 'Cross Platform Native Module',
						path: join(
							__dirname,
							'mocks',
							'cross-platform-native-module',
							'node_modules',
							'cross-platform',
							'android'
						),
						platform: 'android',
						version: '2.0.1',
					},
				},
			},
			ios: {
				'cross-platform': {
					'2.0.1': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Tester',
						copyright: 'Copyright (c) 2026 by Your Company',
						description: 'Pretend Cross Platform Native Module for Titanium SDK',
						guid: 'bba89061-0fdb-4ff1-95a8-02876f5601f9',
						license: 'Apache',
						minsdk: undefined,
						moduleid: 'cross-platform',
						name: 'Cross Platform Native Module',
						path: join(
							__dirname,
							'mocks',
							'cross-platform-native-module',
							'node_modules',
							'cross-platform',
							'ios'
						),
						platform: 'ios',
						version: '2.0.1',
					},
				},
			},
		});
	});

	it('should detect cross-platform Android and iOS in node_modules with specific package.json', async () => {
		config.titanium.sdk.installPath[process.platform] = undefined;
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules({
			searchPaths: [join(__dirname, 'mocks', 'cross-platform-native-module-specific-package-json')],
		});
		expect(modules).toEqual({
			android: {
				'cross-platform': {
					'2.0.1': {
						apiversion: 6,
						architectures: ['armeabi-v7a', 'x86'],
						author: 'Tester',
						copyright: 'Copyright (c) 2026 by Your Company',
						description: 'Pretend Cross Platform Native Module for Titanium SDK',
						guid: 'bba89061-0fdb-4ff1-95a8-02876f5601f9',
						license: 'Apache',
						minsdk: '4.0.0',
						moduleid: 'cross-platform',
						name: 'cross-platform-npm-package',
						path: join(
							__dirname,
							'mocks',
							'cross-platform-native-module-specific-package-json',
							'node_modules',
							'cross-platform',
							'android'
						),
						platform: 'android',
						version: '2.0.1',
					},
				},
			},
			ios: {
				'cross-platform': {
					'2.0.1': {
						apiversion: 1,
						architectures: ['armv7', 'i386'],
						author: 'Tester',
						copyright: 'Copyright (c) 2026 by Your Company',
						description: 'Pretend Cross Platform Native Module for Titanium SDK',
						guid: 'bba89061-0fdb-4ff1-95a8-02876f5601f9',
						license: 'Apache',
						minsdk: '3.0.0',
						moduleid: 'cross-platform',
						name: 'cross-platform-npm-package',
						path: join(
							__dirname,
							'mocks',
							'cross-platform-native-module-specific-package-json',
							'node_modules',
							'cross-platform',
							'ios'
						),
						platform: 'ios',
						version: '2.0.1',
					},
				},
			},
		});
	});

	it('should detect cross-platform Android and iOS in node_modules with manifests', async () => {
		config.titanium.sdk.installPath[process.platform] = undefined;
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules({
			searchPaths: [join(__dirname, 'mocks', 'cross-platform-native-module-with-manifest')],
		});
		expect(modules).toEqual({
			android: {
				'cross-platform-with-manifest': {
					'2.0.1': {
						apiversion: 6,
						architectures: ['armeabi-v7a', 'x86'],
						author: 'Tester',
						copyright: 'Copyright (c) 2026 by Your Company',
						description: 'Pretend Cross Platform Native Module for Titanium SDK',
						guid: 'ccb89061-0fdb-4ff1-95a8-02876f5601f9',
						license: 'Apache',
						minsdk: '4.0.0',
						moduleid: 'cross-platform-with-manifest',
						name: 'cross-platform',
						path: join(
							__dirname,
							'mocks',
							'cross-platform-native-module-with-manifest',
							'node_modules',
							'cross-platform',
							'android'
						),
						platform: 'android',
						version: '2.0.1',
					},
				},
			},
			ios: {
				'cross-platform-with-manifest': {
					'2.0.1': {
						apiversion: 1,
						architectures: ['armv7', 'i386'],
						author: 'Tester',
						copyright: 'Copyright (c) 2026 by Your Company',
						description: 'Pretend Cross Platform Native Module for Titanium SDK',
						guid: 'ccb89061-0fdb-4ff1-95a8-02876f5601f9',
						license: 'Apache',
						minsdk: '3.0.0',
						moduleid: 'cross-platform-with-manifest',
						name: 'cross-platform',
						path: join(
							__dirname,
							'mocks',
							'cross-platform-native-module-with-manifest',
							'node_modules',
							'cross-platform',
							'ios'
						),
						platform: 'ios',
						version: '2.0.1',
					},
				},
			},
		});
	});

	it('should detect native module with manifest', async () => {
		config.titanium.sdk.installPath[process.platform] = undefined;
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules({
			searchPaths: [join(__dirname, 'mocks', 'native-module-with-manifest')],
		});
		expect(modules).toEqual({
			ios: {
				'native-module-with-manifest': {
					'2.0.1': {
						apiversion: 2,
						architectures: ['armv7', 'arm64', 'i386', 'x86_64'],
						author: 'Tester',
						copyright: 'Copyright (c) 2026 by Your Company',
						description: 'Pretend Native Module with manifest file for Titanium SDK',
						guid: 'bba89061-0fdb-4ff1-95a8-02876f5601f9',
						license: 'Apache',
						minsdk: '5.0.0',
						moduleid: 'native-module-with-manifest',
						name: 'native-module-with-manifest',
						path: join(
							__dirname,
							'mocks',
							'native-module-with-manifest',
							'node_modules',
							'native-module-with-manifest'
						),
						platform: 'ios',
						version: '2.0.1',
					},
				},
			},
		});
	});

	it('should detect native module with platform subdirectories', async () => {
		config.titanium.sdk.installPath[process.platform] = undefined;
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules({
			searchPaths: [join(__dirname, 'mocks', 'native-module-with-platform-subdir')],
		});
		expect(modules).toEqual({
			ios: {
				'native-module': {
					'2.0.1': {
						apiversion: undefined,
						architectures: undefined,
						author: 'Tester',
						copyright: 'Copyright (c) 2026 by Your Company',
						description: 'Pretend Native Module for Titanium SDK',
						guid: 'bba89061-0fdb-4ff1-95a8-02876f5601f9',
						license: 'Apache',
						minsdk: undefined,
						moduleid: 'native-module',
						name: 'Native Module',
						path: join(
							__dirname,
							'mocks',
							'native-module-with-platform-subdir',
							'node_modules',
							'native-module',
							'ios'
						),
						platform: 'ios',
						version: '2.0.1',
					},
				},
			},
		});
	});

	it('should detect npm native module', async () => {
		config.titanium.sdk.installPath[process.platform] = undefined;
		config.titanium.sdk.searchPaths[process.platform] = [];

		const modules = await detectTitaniumModules({
			searchPaths: [join(__dirname, 'mocks', 'npm-native-module')],
		});
		expect(modules).toEqual({});
	});

	it('should install modules in a Titanium SDK install location', async () => {
		const tmpDir = join(
			tmpdir(),
			'node-titanium-sdk',
			`module-install-test-${randomBytes(8).toString('hex')}`
		);
		try {
			await mkdir(tmpDir, { recursive: true });
			await copyFile(
				join(__dirname, 'mocks', 'install-modules', 'android-only.zip'),
				join(tmpDir, 'android-only.zip')
			);
			await copyFile(
				join(__dirname, 'mocks', 'install-modules', 'badzip-ios-1.0.0.zip'),
				join(tmpDir, 'badzip-ios-1.0.0.zip')
			);
			await copyFile(
				join(__dirname, 'mocks', 'install-modules', 'dummy-ios-1.2.3.zip'),
				join(tmpDir, 'dummy-ios-1.2.3.zip')
			);
			await copyFile(
				join(__dirname, 'mocks', 'install-modules', 'ios-only.zip'),
				join(tmpDir, 'ios-only.zip')
			);

			config.titanium.sdk.installPath[process.platform] = tmpDir;
			config.titanium.sdk.searchPaths[process.platform] = [];

			const modules = await detectTitaniumModules();
			expect(modules).toEqual({
				android: {
					'ti.map': {
						'3.1.0': {
							apiversion: 2,
							architectures: ['arm64-v8a', 'armeabi-v7a', 'x86'],
							author: 'Tester',
							copyright: 'Copyright (c) 2026 by Your Company',
							description: 'External version of Map module',
							guid: 'fee93b77-8eb3-418c-8f04-013664c4af83',
							license: 'Apache Public License v2',
							minsdk: '6.2.2.GA',
							moduleid: 'ti.map',
							name: 'map',
							path: join(tmpDir, 'modules', 'android', 'ti.map', '3.1.0'),
							platform: 'android',
							version: '3.1.0',
						},
					},
				},
				ios: {
					'ti.ambiguous': {
						'1.0': {
							apiversion: undefined,
							architectures: undefined,
							author: 'Tester',
							copyright: 'Copyright (c) 2018 by Your Company',
							description: 'This is an ambiguous module that will conflict with a commonjs module',
							guid: '8d99922e-7727-4f64-90b9-325992eddb1c',
							license: 'Apache Public License',
							minsdk: '3.0',
							moduleid: 'ti.ambiguous',
							name: 'ambiguous',
							path: join(tmpDir, 'modules', 'ios', 'baz', '2.0.1'),
							platform: 'ios',
							version: '1.0',
						},
					},
					'ti.dummy': {
						'1.2.3': {
							apiversion: undefined,
							architectures: undefined,
							author: 'Tester',
							copyright: 'Copyright (c) 2026 by Your Company',
							description: 'This is a dummy module',
							guid: 'ae19fb34-df25-4978-e70f-a8c1c3d3779d',
							license: 'Apache Public License',
							minsdk: '2.0',
							moduleid: 'ti.dummy',
							name: 'dummy',
							path: join(tmpDir, 'modules', 'ios', 'dummy', '1.2.3'),
							platform: 'ios',
							version: '1.2.3',
						},
					},
				},
			});
		} finally {
			await rm(tmpDir, { recursive: true, force: true });
		}
	});
});
