import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const comTestModuleAndroid = {
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
};

export const comTestModuleIos = {
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
};

export const comTestModuleCommonjs10 = {
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
	path: join(__dirname, 'mocks', 'good', 'modules', 'commonjs', 'invalid-version', '1.0.1'),
	platform: 'commonjs',
	version: '1.0',
};

export const comTestModuleCommonjs = {
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
};
