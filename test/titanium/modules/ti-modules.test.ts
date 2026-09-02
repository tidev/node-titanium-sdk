import { config, resetConfig } from '../../../src/config.js';
import { detectTiModules, TiappXML, TiModuleRegistry } from '../../../src/titanium/index.js';
import {
	TestModuleAndroid,
	TestModuleCommonjs,
	TestModuleCommonjs10,
	TestModuleIos,
	CJSModule1,
	CJSModule2,
	TiMapAndroid,
	TiMapIos,
} from './search-modules.js';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('detectTitaniumModules', () => {
	afterEach(() => resetConfig());

	describe('detect', () => {
		it('should detect Titanium modules', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'good');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const { modules } = await detectTiModules();
			expect(modules).toEqual({
				'com.test.module': {
					android: {
						'1.0.0': TestModuleAndroid,
					},
					commonjs: {
						'1.0': TestModuleCommonjs10,
						'1.0.0': TestModuleCommonjs,
					},
					ios: {
						'1.0.0': TestModuleIos,
					},
				},
			});
		});

		it('should detect modules with Android only', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'android-only');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const { modules } = await detectTiModules();
			expect(modules).toEqual({
				'ti.map': {
					android: {
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
							path: join(
								__dirname,
								'mocks',
								'android-only',
								'modules',
								'android',
								'ti.map',
								'3.1.0'
							),
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

			const { modules } = await detectTiModules();
			expect(modules).toEqual({
				'ti.ambiguous': {
					commonjs: {
						'1.0': {
							apiversion: undefined,
							architectures: undefined,
							author: 'Tester',
							copyright: 'Copyright (c) 2022 by Your Company',
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
					ios: {
						'1.0': {
							apiversion: undefined,
							architectures: undefined,
							author: 'Tester',
							copyright: 'Copyright (c) 2022 by Your Company',
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
				},
				baz: {
					ios: {
						'1.0': {
							apiversion: undefined,
							architectures: undefined,
							author: 'Tester',
							copyright: 'Copyright (c) 2022 by Your Company',
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
				},
				'ti.toonew': {
					ios: {
						'1.0': {
							apiversion: undefined,
							architectures: undefined,
							author: 'Tester',
							copyright: 'Copyright (c) 2022 by Your Company',
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

			const { modules } = await detectTiModules();
			expect(modules).toEqual({
				'ti.latestvalid': {
					commonjs: {
						'1.0': {
							apiversion: undefined,
							architectures: undefined,
							author: 'Tester',
							copyright: 'Copyright (c) 2022 by Your Company',
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
							copyright: 'Copyright (c) 2022 by Your Company',
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

			const { modules } = await detectTiModules();
			expect(modules).toEqual({
				'ti.ambiguous': {
					ios: {
						'1.0': {
							apiversion: undefined,
							architectures: undefined,
							author: 'Tester',
							copyright: 'Copyright (c) 2022 by Your Company',
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

			const { modules } = await detectTiModules();
			expect(modules).toEqual({
				'ti.map': {
					ios: {
						'3.1.0': {
							apiversion: 2,
							architectures: ['armv7', 'arm64', 'i386', 'x86_64'],
							author: 'Tester',
							copyright: 'Copyright (c) 2022 by Your Company',
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

			const { modules } = await detectTiModules();
			expect(modules).toEqual({});
		});

		it('should detect nothing in non-existent directory', async () => {
			config.titanium.sdk.installPath[process.platform] = join(
				__dirname,
				'mocks',
				'does-not-exist'
			);
			config.titanium.sdk.searchPaths[process.platform] = [];

			const { modules } = await detectTiModules();
			expect(modules).toEqual({});
		});

		it('should detect cross-platform Android and iOS in node_modules', async () => {
			config.titanium.sdk.installPath[process.platform] = undefined;
			config.titanium.sdk.searchPaths[process.platform] = [];

			const { modules } = await detectTiModules({
				searchPaths: [join(__dirname, 'mocks', 'cross-platform-native-module')],
			});
			expect(modules).toEqual({
				'cross-platform': {
					android: {
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
					ios: {
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

			const { modules } = await detectTiModules({
				searchPaths: [
					join(__dirname, 'mocks', 'cross-platform-native-module-specific-package-json'),
				],
			});
			expect(modules).toEqual({
				'cross-platform': {
					android: {
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
					ios: {
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

			const { modules } = await detectTiModules({
				searchPaths: [join(__dirname, 'mocks', 'cross-platform-native-module-with-manifest')],
			});
			expect(modules).toEqual({
				'cross-platform-with-manifest': {
					android: {
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
					ios: {
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

			const { modules } = await detectTiModules({
				searchPaths: [join(__dirname, 'mocks', 'native-module-with-manifest')],
			});
			expect(modules).toEqual({
				'native-module-with-manifest': {
					ios: {
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

			const { modules } = await detectTiModules({
				searchPaths: [join(__dirname, 'mocks', 'native-module-with-platform-subdir')],
			});
			expect(modules).toEqual({
				'native-module': {
					ios: {
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

			const { modules } = await detectTiModules({
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

				const { modules } = await detectTiModules();
				expect(modules).toEqual({
					'ti.map': {
						android: {
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
					'ti.ambiguous': {
						ios: {
							'1.0': {
								apiversion: undefined,
								architectures: undefined,
								author: 'Tester',
								copyright: 'Copyright (c) 2018 by Your Company',
								description:
									'This is an ambiguous module that will conflict with a commonjs module',
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
					},
					'ti.dummy': {
						ios: {
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

	describe('search', () => {
		it('should error if modules is invalid', async () => {
			const registry = new TiModuleRegistry();
			await expect(registry.search({ modules: undefined as any })).rejects.toThrow(
				'Expected modules to be an array'
			);
			await expect(registry.search({ modules: 'foo' as any })).rejects.toThrow(
				'Expected modules to be an array'
			);
		});

		it('should error if module has invalid version', async () => {
			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module version="1.0.0">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			data.modules[0].version = 'foo';

			const registry = await detectTiModules();

			await expect(registry.search({ modules: data.modules })).rejects.toThrow(
				'Module "ti.map" has invalid version "foo"'
			);
		});

		it('should return nothing if modules is empty', async () => {
			const registry = new TiModuleRegistry();
			const modules = await registry.search({ modules: [] });
			expect(modules).toEqual({ found: [], missing: [], incompatible: [], conflict: [] });
		});

		it('should error if module does not have an id', async () => {
			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module>foo</module>
	</modules>
</ti:app>`)
				.data();
			data.modules[0].moduleid = '';
			const registry = new TiModuleRegistry();
			await expect(registry.search({ modules: data.modules })).rejects.toThrow(
				'Module has no module id'
			);
		});

		it('should search for modules by module id and find conflicts with different platforms', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module>ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			// match module id only - same moduleid with different platforms (android, commonjs, ios) = conflict
			expect(await registry.search({ modules: data.modules })).toEqual({
				found: [],
				missing: [],
				incompatible: [],
				conflict: [TiMapAndroid, TiMapIos],
			});
		});

		it('should search for modules by module id without version and choose latest', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module>cjs-module</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			// match module id only - same moduleid with different platforms (android, commonjs, ios) = conflict
			expect(await registry.search({ modules: data.modules })).toEqual({
				found: [CJSModule2],
				missing: [],
				incompatible: [],
				conflict: [],
			});
		});

		it('should search for modules by module id and platform', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="android">ti.map</module>
		<module platform="ios">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			// match module id, platform, and version
			expect(await registry.search({ modules: data.modules, platform: ['android'] })).toEqual({
				found: [TiMapAndroid],
				missing: [],
				incompatible: [],
				conflict: [],
			});
		});

		it('should search for modules by module id and multiple platforms', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="android,ios">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			// match module id, platform, and version
			expect(await registry.search({ modules: data.modules, platform: ['android'] })).toEqual({
				found: [TiMapAndroid],
				missing: [],
				incompatible: [],
				conflict: [],
			});
		});

		it('should search by module id, platform, and version', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="commonjs" version="1.0.0">cjs-module</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			expect(await registry.search({ modules: data.modules, platform: ['commonjs'] })).toEqual({
				found: [CJSModule1],
				missing: [],
				incompatible: [],
				conflict: [],
			});
		});

		it('should search modules by module id and array of multiple platforms', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="android">ti.map</module>
		<module platform="ios">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			expect(
				await registry.search({
					modules: data.modules,
					platform: ['iphone', 'ios'],
					sdkVersion: '12.8.0',
				})
			).toEqual({
				found: [TiMapIos],
				missing: [],
				incompatible: [],
				conflict: [],
			});
		});

		it('should search modules by module id and string of multiple platforms', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="android">ti.map</module>
		<module platform="ios">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			expect(
				await registry.search({
					modules: data.modules,
					platform: 'iphone,ios',
					sdkVersion: '12.8.0',
				})
			).toEqual({
				found: [TiMapIos],
				missing: [],
				incompatible: [],
				conflict: [],
			});
		});

		it('should search and find a missing module', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="android">ti.missing</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			// match module id, platform, and version
			expect(await registry.search({ modules: data.modules, platform: ['android'] })).toEqual({
				found: [],
				missing: [
					{
						moduleid: 'ti.missing',
						platform: 'android',
						version: undefined,
						deployType: undefined,
					},
				],
				incompatible: [],
				conflict: [],
			});
		});

		it('should search for module with deploy type', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="android" deploy-type="test">ti.map</module>
		<module platform="ios" deploy-type="production">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			expect(await registry.search({ modules: data.modules, deployType: 'test' })).toEqual({
				found: [TiMapAndroid],
				missing: [],
				incompatible: [],
				conflict: [],
			});
		});

		it('should search for module with no versions', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="commonjs">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			expect(await registry.search({ modules: data.modules })).toEqual({
				found: [],
				missing: [
					{
						moduleid: 'ti.map',
						platform: 'commonjs',
						version: undefined,
						deployType: undefined,
					},
				],
				incompatible: [],
				conflict: [],
			});
		});

		it('should search for module with incompatible API version', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="android">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			expect(await registry.search({ modules: data.modules, moduleAPIVersion: '2' })).toEqual({
				found: [],
				missing: [],
				incompatible: [TiMapAndroid],
				conflict: [],
			});
		});

		it('should search for module with compatible API version', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="android">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			expect(await registry.search({ modules: data.modules, moduleAPIVersion: '4' })).toEqual({
				found: [TiMapAndroid],
				missing: [],
				incompatible: [],
				conflict: [],
			});
		});

		it('should search for module with incompatible SDK version', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="android">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			expect(await registry.search({ modules: data.modules, sdkVersion: '10.0.0' })).toEqual({
				found: [],
				missing: [],
				incompatible: [TiMapAndroid],
				conflict: [],
			});
		});

		it('should search for module with compatible SDK version', async () => {
			config.titanium.sdk.installPath[process.platform] = join(__dirname, 'mocks', 'search-test');
			config.titanium.sdk.searchPaths[process.platform] = [];

			const data = new TiappXML()
				.parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module platform="android">ti.map</module>
	</modules>
</ti:app>`)
				.data();
			const registry = await detectTiModules();

			expect(await registry.search({ modules: data.modules, sdkVersion: '12.8.0' })).toEqual({
				found: [TiMapAndroid],
				missing: [],
				incompatible: [],
				conflict: [],
			});
		});
	});
});
