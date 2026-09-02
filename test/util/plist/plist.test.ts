import {
	parsePlist,
	readPlist,
	readPlistSync,
	writePlist,
	writePlistSync,
} from '../../../src/util/plist.js';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures');

let tmpDir: string;
beforeEach(async () => {
	tmpDir = join(tmpdir(), 'node-titanium-sdk', `plist-test-${randomBytes(8).toString('hex')}`);
	await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
	if (existsSync(tmpDir)) {
		await rm(tmpDir, { force: true, recursive: true });
	}
});

describe('Plist', () => {
	describe('parse', () => {
		it('should parse a plist string', () => {
			const plist = parsePlist(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>name</key>
	<string>test</string>
	<key>age</key>
	<integer>20</integer>
	<key>friends</key>
	<array>
		<string>John</string>
		<string>Jane</string>
		<string>Jim</string>
	</array>
	<key>address</key>
	<dict>
		<key>street</key>
		<string>123 Main St</string>
		<key>city</key>
		<string>Anytown</string>
		<key>state</key>
		<string>CA</string>
		<key>zip</key>
		<string>12345</string>
	</dict>
</dict>
</plist>`);
			expect(plist).toEqual({
				name: 'test',
				age: 20,
				friends: ['John', 'Jane', 'Jim'],
				address: {
					street: '123 Main St',
					city: 'Anytown',
					state: 'CA',
					zip: '12345',
				},
			});
		});

		it('should error if the plist is invalid', () => {
			expect(() => parsePlist('not a plist file')).toThrow('Invalid plist:');
		});
	});

	describe('read', () => {
		it('should load a plist file synchronously', () => {
			const plist = readPlistSync(join(fixturesDir, 'Info.plist'));
			expect(plist).toEqual({
				CFBundleDevelopmentRegion: 'English',
				CFBundleDisplayName: '${PRODUCT_NAME}',
				CFBundleExecutable: '${EXECUTABLE_NAME}',
				CFBundleURLTypes: [{ CFBundleURLName: '__URL__', CFBundleURLSchemes: ['__URLSCHEME__'] }],
				CFBundleIdentifier: 'com.titaniumsdk.titanium',
				CFBundleInfoDictionaryVersion: '6.0',
				CFBundleName: '${PRODUCT_NAME}',
				CFBundlePackageType: 'APPL',
				CFBundleSignature: '????',
				CFBundleVersion: '1.0',
				CFBundleShortVersionString: '1.0',
				LSRequiresIPhoneOS: true,
			});
		});

		it('should load a plist file asynchronously', async () => {
			const plist = await readPlist(join(fixturesDir, 'Info.plist'));
			expect(plist).toEqual({
				CFBundleDevelopmentRegion: 'English',
				CFBundleDisplayName: '${PRODUCT_NAME}',
				CFBundleExecutable: '${EXECUTABLE_NAME}',
				CFBundleURLTypes: [{ CFBundleURLName: '__URL__', CFBundleURLSchemes: ['__URLSCHEME__'] }],
				CFBundleIdentifier: 'com.titaniumsdk.titanium',
				CFBundleInfoDictionaryVersion: '6.0',
				CFBundleName: '${PRODUCT_NAME}',
				CFBundlePackageType: 'APPL',
				CFBundleSignature: '????',
				CFBundleVersion: '1.0',
				CFBundleShortVersionString: '1.0',
				LSRequiresIPhoneOS: true,
			});
		});

		it('should throw an error if the plist file does not exist', () => {
			expect(() => readPlistSync(join(fixturesDir, 'does-not-exist.plist'))).toThrow(
				'plist file does not exist'
			);
		});

		it('should throw an error if the plist file is not a valid plist', () => {
			expect(() => readPlistSync(join(fixturesDir, 'invalid.txt'))).toThrow('Invalid plist:');
		});
	});

	describe('write', () => {
		it('should write a plist file synchronously', () => {
			const obj = {
				name: 'test',
				age: 20,
				friends: ['John', 'Jane', 'Jim'],
				address: {
					street: '123 Main St',
					city: 'Anytown',
					state: 'CA',
					zip: '12345',
				},
			};
			writePlistSync(join(tmpDir, 'test.plist'), obj);
			const plist = readPlistSync<typeof obj>(join(tmpDir, 'test.plist'));
			expect(plist).toEqual(obj);
		});

		it('should write a plist file asynchronously', async () => {
			const obj = {
				name: 'test',
				age: 20,
				friends: ['John', 'Jane', 'Jim'],
				address: {
					street: '123 Main St',
					city: 'Anytown',
					state: 'CA',
					zip: '12345',
				},
			};
			await writePlist(join(tmpDir, 'test.plist'), obj);
			const plist = await readPlist<typeof obj>(join(tmpDir, 'test.plist'));
			expect(plist).toEqual(obj);
		});
	});
});
