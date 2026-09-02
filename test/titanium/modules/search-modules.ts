import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const TestModuleAndroid = {
	apiversion: 4,
	architectures: ['arm64-v8a', 'armeabi-v7a', 'x86'],
	author: 'Your Name',
	copyright: 'Copyright (c) 2022 by Your Company',
	description: 'testModule',
	guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
	license: 'Specify your license',
	minsdk: '7.2.0',
	moduleid: 'com.test.module',
	name: 'testModule',
	path: join(__dirname, 'mocks', 'good', 'modules', 'android', 'test-module', '1.0.0'),
	platform: 'android',
	version: '1.0.0',
};

export const TestModuleCommonjs = {
	apiversion: undefined,
	architectures: undefined,
	author: 'Your Name',
	copyright: 'Copyright (c) 2022 by Your Company',
	description: 'testModule',
	guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
	license: 'Specify your license',
	minsdk: '7.2.0',
	moduleid: 'com.test.module',
	name: 'testModule',
	path: join(__dirname, 'mocks', 'good', 'modules', 'commonjs', 'test-module', '1.0.0'),
	platform: 'commonjs',
	version: '1.0.0',
};

export const TestModuleCommonjs10 = {
	apiversion: undefined,
	architectures: undefined,
	author: 'Your Name',
	copyright: 'Copyright (c) 2022 by Your Company',
	description: 'testModule',
	guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
	license: 'Specify your license',
	minsdk: '7.2.0',
	moduleid: 'com.test.module',
	name: 'testModule',
	path: join(__dirname, 'mocks', 'good', 'modules', 'commonjs', 'invalid-version', '1.0.1'),
	platform: 'commonjs',
	version: '1.0',
};

export const TestModuleIos = {
	apiversion: 2,
	architectures: ['armv7', 'arm64', 'i386', 'x86_64'],
	author: 'Your Name',
	copyright: 'Copyright (c) 2022 by Your Company',
	description: 'testModule',
	guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
	license: 'Specify your license',
	minsdk: '7.2.0',
	moduleid: 'com.test.module',
	name: 'testModule',
	path: join(__dirname, 'mocks', 'good', 'modules', 'iphone', 'test-module', '1.0.0'),
	platform: 'ios',
	version: '1.0.0',
};

export const CJSModule1 = {
	apiversion: undefined,
	architectures: undefined,
	author: 'Your Name',
	copyright: 'Copyright (c) 2022 by Your Company',
	description: 'CommonJS Module',
	guid: 'dcaea77e-2860-42c1-a57b-319f81da10e0',
	license: 'Specify your license',
	minsdk: '7.2.0',
	moduleid: 'cjs-module',
	name: 'CJS Module',
	path: join(__dirname, 'mocks', 'search-test', 'modules', 'commonjs', 'cjs-module', '1.0.0'),
	platform: 'commonjs',
	version: '1.0.0',
};

export const CJSModule2 = {
	apiversion: undefined,
	architectures: undefined,
	author: 'Your Name',
	copyright: 'Copyright (c) 2022 by Your Company',
	description: 'CommonJS Module',
	guid: 'dcaea77e-2860-42c1-a57b-319f81da10e1',
	license: 'Specify your license',
	minsdk: '10.0.0',
	moduleid: 'cjs-module',
	name: 'CJS Module',
	path: join(__dirname, 'mocks', 'search-test', 'modules', 'commonjs', 'cjs-module', '2.0.0'),
	platform: 'commonjs',
	version: '2.0.0',
};

export const TiMapAndroid = {
	apiversion: 4,
	architectures: ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'],
	author: 'Your Name',
	copyright: 'Copyright (c) 2022 by Your Company',
	description: 'External version of Map module using native Google Maps library',
	guid: 'f0d8fd44-86d2-4730-b67d-bd454577aeee',
	license: 'Apache Public License v2',
	minsdk: '12.7.0',
	moduleid: 'ti.map',
	name: 'map',
	path: join(__dirname, 'mocks', 'search-test', 'modules', 'android', 'ti.map', '5.7.0'),
	platform: 'android',
	version: '5.7.0',
};

export const TiMapIos = {
	apiversion: 2,
	architectures: ['arm64', 'x86_64'],
	author: 'Your name',
	copyright: 'Copyright (c) 2022 by Your Company',
	description: 'External version of Map module',
	guid: 'f0d8fd44-86d2-4730-b67d-bd454577aeee',
	license: 'Apache Public License v2',
	minsdk: '10.0.0',
	moduleid: 'ti.map',
	name: 'map',
	path: join(__dirname, 'mocks', 'search-test', 'modules', 'iphone', 'ti.map', '7.3.1'),
	platform: 'ios',
	version: '7.3.1',
};
