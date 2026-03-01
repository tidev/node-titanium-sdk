import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const TestModuleAndroid = {
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
	path: join(__dirname, 'mocks', 'search-test', 'modules', 'android', 'test-module', '1.0.0'),
	platform: 'android',
	version: '1.0.0',
};

export const TestModuleCommonjs = {
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
	path: join(__dirname, 'mocks', 'search-test', 'modules', 'commonjs', 'test-module', '1.0.0'),
	platform: 'commonjs',
	version: '1.0.0',
};

export const TestModuleIos = {
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
	path: join(__dirname, 'mocks', 'search-test', 'modules', 'iphone', 'test-module', '1.0.0'),
	platform: 'ios',
	version: '1.0.0',
};

export const TiMapAndroid = {
	apiversion: 4,
	architectures: ['arm64-v8a', 'armeabi-v7a', 'x86'],
	author: 'Appcelerator',
	copyright: 'Copyright (c) 2013-present by Axway, Inc.',
	description: 'External version of Map module',
	guid: 'f0d8fd44-86d2-4730-b67d-bd454577aeee',
	license: 'Apache Public License v2',
	minsdk: '10.0.0.GA',
	moduleid: 'ti.map',
	name: 'map',
	path: join(__dirname, 'mocks', 'search-test', 'modules', 'android', 'ti.map', '5.7.0'),
	platform: 'android',
	version: '5.7.0',
};

export const TiMapIos = {
	apiversion: 2,
	architectures: ['armv7', 'arm64', 'i386', 'x86_64'],
	author: 'Jeff Haynie, Jon Alter, Pedro Enrique, Hans Knöchel, Vijay Singh',
	copyright: 'Copyright (c) 2013-present by Axway Appcelerator',
	description: 'External version of Map module',
	guid: 'f0d8fd44-86d2-4730-b67d-bd454577aeee',
	license: 'Apache Public License v2',
	minsdk: '10.0.0.GA',
	moduleid: 'ti.map',
	name: 'map',
	path: join(__dirname, 'mocks', 'search-test', 'modules', 'iphone', 'ti.map', '7.3.1'),
	platform: 'ios',
	version: '7.3.1',
};
