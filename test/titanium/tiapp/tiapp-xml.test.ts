import { TiappXML } from '../../../src/titanium/tiapp/tiapp-xml.js';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures');

describe('TiappXML', () => {
	describe('Basic Operations', () => {
		it('should handle missing properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);
			const data = tiapp.data();
			expect(data).toMatchObject({ id: 'test' });
		});
	});

	describe('Property Modification', () => {
		it('should update properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
			const data = tiapp.data();
			data.name = 'newname';
			tiapp.apply(data);

			expect(tiapp.data().name).toBe('newname');
			const xml = tiapp.toString();
			expect(xml).toContain('<name>newname</name>');
		});

		it('should create new properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);

			const data = tiapp.data();
			data.publisher = 'Test Publisher';
			tiapp.apply(data);

			expect(tiapp.data().publisher).toBe('Test Publisher');
			const xml = tiapp.toString();
			expect(xml).toContain('<publisher>Test Publisher</publisher>');
		});

		it('should handle property deletion', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
	<name>test</name>
	<icon>icon.png</icon>
</ti:app>`);

			const data = tiapp.data();
			expect(data.icon).toBe('icon.png');
			delete data.icon;
			tiapp.apply(data);

			expect(tiapp.data().icon).toBeUndefined();
			const xml = tiapp.toString();
			expect(xml).not.toContain('<icon>');
		});
	});

	describe('Platform-Specific Properties', () => {
		it('should handle platform-specific ids', () => {
			const xml = `<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>com.example.app</id>
	<id platform="android">com.example.android</id>
</ti:app>`;

			const tiapp = new TiappXML().parse(xml);
			const data = tiapp.data();

			expect(data.id).toBe('com.example.app');
			expect(data.idPlatformAndroid).toBe('com.example.android');
		});

		it('should create platform-specific properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>com.example.app</id>
</ti:app>`);

			const data = tiapp.data();
			data.id = 'com.example.app2';
			data.idPlatformIos = 'com.example.ios';
			tiapp.apply(data);

			expect(tiapp.data().id).toBe('com.example.app2');
			expect(tiapp.data().idPlatformIos).toBe('com.example.ios');
			expect(tiapp.toString()).toContain('<id platform="ios">com.example.ios</id>');
		});
	});

	describe('Modules Array', () => {
		it('should read modules array', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.modules).toBeDefined();
			expect(Array.isArray(data.modules)).toBe(true);
			expect(data.modules!.length).toBeGreaterThan(0);
		});

		it('should handle module properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			const firstModule = data.modules![0];
			expect(firstModule).toBeDefined();
			expect(firstModule.id).toBe('ti.alltest');
			expect(firstModule.version).toBe('1.2.3');
		});

		it('should add modules', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
	<modules></modules>
</ti:app>`);

			const data = tiapp.data();
			data.modules = data.modules || [];
			data.modules.push({ id: 'ti.test', platform: 'android', version: '1.0' });
			tiapp.apply(data);

			expect(tiapp.data().modules!.length).toBe(1);

			const xml = tiapp.toString();
			expect(xml).toContain('ti.test');
		});

		it('should remove modules', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			const initialLength = data.modules!.length;
			data.modules!.pop();
			tiapp.apply(data);

			expect(tiapp.data().modules!.length).toBe(initialLength - 1);
		});
	});

	describe('Properties (Key-Value)', () => {
		it('should read properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.properties!['ti.ui.defaultunit']).toBe('system');
		});

		it('should handle boolean properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.properties!['ti.android.debug']).toBe(true);
		});

		it('should add properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);

			const data = tiapp.data();
			data.properties = data.properties || {};
			data.properties['my.prop'] = 'test';
			tiapp.apply(data);

			expect(tiapp.data().properties!['my.prop']).toBe('test');

			const xml = tiapp.toString();
			expect(xml).toContain('name="my.prop"');
		});

		it('should delete properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.properties!['ti.ui.defaultunit']).toBeDefined();
			delete data.properties!['ti.ui.defaultunit'];
			tiapp.apply(data);

			expect(tiapp.data().properties!['ti.ui.defaultunit']).toBeUndefined();
		});
	});

	describe('iOS Configuration', () => {
		it('should read iOS config', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.ios).toBeDefined();
			expect(data.ios!.minIosVer).toBe('5.0');
			expect(data.ios!.teamId).toBe('foo');
		});

		it('should read iOS plist', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.ios!.plist).toBeDefined();
			expect(typeof data.ios!.plist).toBe('string');
			expect(data.ios!.plist).toContain('<dict>');
		});

		it('should read iOS capabilities', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.ios!.capabilities).toBeDefined();
			expect(data.ios!.capabilities!.appGroups).toBeDefined();
			expect(Array.isArray(data.ios!.capabilities!.appGroups)).toBe(true);
		});
	});

	describe('Android Configuration', () => {
		it('should read Android config', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.android).toBeDefined();
			expect(data.android!.toolAPILevel).toBe(10);
		});

		it('should read Android ABI as array', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.android!.abi).toBeDefined();
			expect(Array.isArray(data.android!.abi)).toBe(true);
			expect(data.android!.abi!.length).toBeGreaterThan(0);
		});

		it('should read Android manifest', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.android!.manifest).toBeDefined();
			expect(typeof data.android!.manifest).toBe('string');
		});
	});

	describe('Deployment Targets', () => {
		it('should read deployment targets', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data.deploymentTargets).toBeDefined();
			expect(data.deploymentTargets!.android).toBeDefined();
		});
	});

	describe('Whitespace Preservation', () => {
		it('should preserve whitespace when adding properties', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>com.test</id>
	<name>test</name>
</ti:app>`;

			const tiapp = new TiappXML().parse(xml);
			const data = tiapp.data();
			data.version = '1.0.0';
			tiapp.apply(data);

			const output = tiapp.toString();
			expect(output).toContain('\n\t<version>1.0.0</version>');
		});

		it('should preserve existing formatting', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
			const data = tiapp.data();
			data.name = data.name; // Set to same value
			tiapp.apply(data);

			const newXml = tiapp.toString();
			expect(newXml.split('\n').length).toBeGreaterThan(5);
		});
	});

	describe('JSON Serialization', () => {
		it('should support JSON.stringify', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>com.test</id>
	<name>testapp</name>
	<version>1.0</version>
</ti:app>`);

			const data = tiapp.data();
			const json = JSON.stringify(data);
			const parsed = JSON.parse(json);

			expect(parsed.id).toBe('com.test');
			expect(parsed.name).toBe('testapp');
			expect(parsed.version).toBe('1.0');

			expect(parsed.load).toBeUndefined();
			expect(parsed.save).toBeUndefined();
		});

		it('should handle data as plain object', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			expect(data).toHaveProperty('id');
			expect(data).toHaveProperty('name');
			expect(Object.getPrototypeOf(data)).toBe(Object.prototype);
		});

		it('should handle JSON serialization with nested objects', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			const json = JSON.stringify(data, null, 2);
			const parsed = JSON.parse(json);

			expect(parsed.ios).toBeDefined();
			expect(parsed.modules).toBeDefined();
			expect(Array.isArray(parsed.modules)).toBe(true);
		});

		it('should handle platform-specific properties in JSON', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>com.example.app</id>
	<id platform="android">com.example.android</id>
	<id platform="ios">com.example.ios</id>
</ti:app>`);

			const data = tiapp.data();
			const json = JSON.stringify(data);
			const parsed = JSON.parse(json);

			expect(parsed.id).toBeDefined();
			expect(typeof parsed.id === 'object' || typeof parsed.id === 'string').toBe(true);
		});

		it('should output JSON format', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
			const data = tiapp.data();
			expect(data.id).toBe('ti.testapp');
		});
	});

	describe('toString()', () => {
		it('should output XML format', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
			const xml = tiapp.toString();

			expect(xml).toContain('<?xml');
			expect(xml).toContain('<ti:app');
			expect(xml).toContain('</ti:app>');
		});

		it('should set xml version if not present', () => {
			const tiapp = new TiappXML().parse(`<ti:app xmlns:ti="http://ti.tidev.io">
</ti:app>`);
			expect(tiapp.toString()).toMatch(/^<\?xml/);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty tiapp.xml', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
</ti:app>`);

			const data = tiapp.data();
			expect(data.id).toBeUndefined();
			expect(data.name).toBeUndefined();
		});

		it('should handle numeric values', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);

			const data = tiapp.data();
			data.version = '2.0';
			tiapp.apply(data);

			expect(tiapp.data().version).toBe('2.0');

			const xml = tiapp.toString();
			expect(xml).toContain('<version>2.0</version>');
		});

		it('should handle boolean values', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);

			const data = tiapp.data();
			data.persistentWifi = true;
			tiapp.apply(data);

			expect(tiapp.data().persistentWifi).toBe(true);

			const xml = tiapp.toString();
			expect(xml).toContain('<persistent-wifi>true</persistent-wifi>');
		});

		it('should error if file does not exist', () => {
			const tiapp = new TiappXML();
			expect(() => tiapp.load(join(fixturesDir, 'does_not_exist.xml'))).toThrow(
				'tiapp.xml file does not exist'
			);
		});
	});

	describe('Save Operations', () => {
		afterEach(async () => {
			await rm('/tmp/test-tiapp.xml', { force: true });
		});

		it('should save to file', async () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
	<name>test</name>
</ti:app>`);

			const tmpFile = join('/tmp', 'test-tiapp.xml');
			tiapp.save(tmpFile);

			const tiapp2 = new TiappXML().load(tmpFile);
			const data = tiapp2.data();
			expect(data.id).toBe('test');
			expect(data.name).toBe('test');
		});
	});

	describe('Schema Validation', () => {
		it('should throw on invalid data when applying', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);

			const data = tiapp.data();
			data.modules = [{ id: 123 }] as any; // invalid: id should be string

			expect(() => tiapp.apply(data)).toThrow('Invalid tiapp data');
		});
	});

	describe('Errors', () => {
		it('should error if file does not exist', () => {
			const tiapp = new TiappXML();
			expect(() => tiapp.load(join(fixturesDir, 'does_not_exist.xml'))).toThrow(
				'tiapp.xml file does not exist'
			);
		});

		it('should error if file is not a valid XML file', () => {
			const tiapp = new TiappXML();
			expect(() => tiapp.load(join(fixturesDir, 'invalid.xml'))).toThrow('Invalid XML file');
		});
	});

	describe('Sample Files', () => {
		it('should load a tiapp during construction', () => {
			const tiapp = new TiappXML(join(fixturesDir, 'hassdk.xml'));
			const data = tiapp.data();
			expect(data.sdkVersion).toBe('1.2.3');
		});

		it('should load a tiapp after construction', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'hassdk.xml'));
			const data = tiapp.data();
			expect(data.sdkVersion).toBe('1.2.3');
		});

		it('should read simple properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
			const data = tiapp.data();
			expect(data).toMatchObject({
				id: 'ti.testapp',
				name: 'testapp',
				version: '1.0',
				publisher: 'tester',
				url: 'https://titaniumsdk.com',
				description: 'not specified',
				copyright: '2022 by tester',
				icon: 'appicon.png',
				persistentWifi: false,
				prerenderedIcon: false,
				statusbarStyle: 'default',
				statusbarHidden: false,
				guid: '088dc83c-64af-4a81-b57c-7407649453f0',
				modules: [],
				android: {},
			});
		});

		it('should read complex properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();
			expect(data).toMatchObject({
				deploymentTargets: {
					iphone: true,
					ipad: true,
					android: true,
				},
				sdkVersion: '2.2.0',
				id: 'ti.testapp',
				idPlatformAndroid: 'ti.testapp.android',
				idPlatformIos: 'ti.testapp.ios',
				name: 'testapp',
				version: '1.0',
				publisher: 'tester',
				url: 'http://',
				description: 'not specified',
				copyright: '2012 by tester',
				icon: 'appicon.png',
				persistentWifi: false,
				prerenderedIcon: false,
				statusbarStyle: 'default',
				statusbarHidden: false,
				fullscreen: false,
				navbarHidden: false,
				guid: '088dc83c-64af-4a81-b57c-7407649453f0',
				properties: {
					'ti.ui.defaultunit': 'system',
					'ti.deploytype': 'production',
					'ti.android.debug': true,
					'ti.android.loadfromsdcard': false,
					'ti.android.compilejs': false,
					'another property': 'this "one" with quotes',
					'ti.bb.invoke.target.key.push': 'ti.testapp.invoke.push',
					'ti.bb.invoke.target.key.open': 'ti.testapp.invoke.open',
					push_title: 'Some Title for BB Push, typically the app name"',
					'ti.skipAppIdValidation': false,
					'ti.skipVersionValidation': false,
				},
				ios: {
					enableLaunchScreenStoryboard: true,
					useAppThinning: true,
					enablecoverage: true,
					enablemdfind: true,
					defaultBackgroundColor: '#FFFFFF',
					minIosVer: '5.0',
					teamId: 'foo',
					logServerPort: 10571,
					capabilities: {
						appGroups: ['group.com.appc.foo', 'group.com.appc.bar'],
					},
					entitlements: {
						'application-identifier': 'XXXXXXXXXX.com.test.app',
						'aps-environment': 'production',
					},
					plist: `<plist>
      <dict>
        <key>UISupportedInterfaceOrientations</key>
        <array>
          <string>UIInterfaceOrientationPortrait</string>
          <string>UIInterfaceOrientationPortraitUpsideDown</string>
          <string>UIInterfaceOrientationLandscapeLeft</string>
          <string>UIInterfaceOrientationLandscapeRight</string>
        </array>
        <key>UIBackgroundModes</key>
        <array>
          <string>audio</string>
          <string>location</string>
          <string>voip</string>
          <string>newsstand-content</string>
          <string>external-accessory</string>
          <string>bluetooth-central</string>
        </array>
        <key>UIRequiredDeviceCapabilities</key>
        <array>
          <string>telephony</string>
          <string>wifi</string>
          <string>sms</string>
          <string>still-camera</string>
          <string>auto-focus-camera</string>
          <string>front-facing-camera</string>
          <string>camera-flash</string>
          <string>video-camera</string>
          <string>accelerometer</string>
          <string>gyroscope</string>
          <string>location-services</string>
          <string>gps</string>
          <string>magnetometer</string>
          <string>gamekit</string>
          <string>microphone</string>
          <string>opengles-1</string>
          <string>opengles-2</string>
          <string>armv6</string>
          <string>armv7</string>
          <string>peer-peer</string>
          <string>bluetooth-le</string>
        </array>
        <key>UIRequiresPersistentWiFi</key>
        <true/>
        <key>UIPrerenderedIcon</key>
        <true/>
        <key>UIStatusBarHidden</key>
        <true/>
        <key>UIStatusBarStyle</key>
        <string>UIStatusBarStyleBlackTranslucent</string>
        <key>UIAppFonts</key>
        <array>
          <string>/fonts/MyFont_1.otf</string>
          <string>/fonts/MyFont_2.otf</string>
        </array>
      </dict>
    </plist>`,
					extensions: [
						{
							projectPath: '/path/to/extention',
							target: 'Some Target',
							provisioningProfiles: [],
						},
						{
							projectPath: '/path/to/extention2',
							target: 'Another Target',
							provisioningProfiles: [
								{
									device: 'abc',
									distAppstore: '123',
									distAdhoc: true,
								},
							],
						},
						{
							projectPath: '/path/to/another/extention',
							target: 'Test WatchKit Extension',
						},
					],
				},
				android: {
					manifest: `<manifest>
      <uses-sdk android:minSdkVersion="10" android:targetSdkVersion="17" android:maxSdkVersion="18"/>
      <supports-screens android:anyDensity="false" android:xlargeScreens="true"/>
      <application>
        <activity android:alwaysRetainTaskState="true" android:configChanges="keyboardHidden|orientation" android:label="testapp" android:name=".TestappActivity" android:theme="@style/Theme.Titanium">
          <intent-filter>
            <action android:name="android.intent.action.MAIN"/>
            <category android:name="android.intent.category.LAUNCHER"/>
          </intent-filter>
        </activity>
        <activity android:screenOrientation="landscape" android:name="ti.modules.titanium.facebook.FBActivity" android:theme="@android:style/Theme.Translucent.NoTitleBar"/>
        <activity android:screenOrientation="landscape" android:name="org.appcelerator.titanium.TiActivity" android:configChanges="keyboardHidden|orientation"/>
        <activity android:screenOrientation="landscape" android:name="org.appcelerator.titanium.TiModalActivity" android:configChanges="keyboardHidden|orientation" android:theme="@android:style/Theme.Translucent.NoTitleBar.Fullscreen"/>
        <activity android:screenOrientation="landscape" android:name="ti.modules.titanium.ui.TiTabActivity" android:configChanges="keyboardHidden|orientation"/>
        <activity android:screenOrientation="landscape" android:name="ti.modules.titanium.media.TiVideoActivity" android:configChanges="keyboardHidden|orientation" android:theme="@android:style/Theme.NoTitleBar.Fullscreen"/>
        <activity android:screenOrientation="landscape" android:name="ti.modules.titanium.ui.android.TiPreferencesActivity"/>
      </application>
    </manifest>`,
					services: [
						{
							type: 'interval',
							url: 'testservice.js',
						},
					],
					activities: [
						{
							url: 'activity.js',
						},
					],
					abi: ['armeabi', 'armeabi-v7a', 'x86'],
				},
				modules: [
					{
						id: 'ti.alltest',
						version: '1.2.3',
					},
					{
						id: 'ti.cjstest',
						version: '1.2.3',
						platform: 'commonjs',
					},
					{
						id: 'ti.mwtest',
						version: '4.5.6',
					},
					{
						id: 'ti.androidtest',
						version: '7.8',
						platform: 'android',
					},
					{
						id: 'ti.iphonetest',
						version: '9.0',
						platform: 'iphone',
					},
				],
				plugins: [
					{
						id: 'ti_sample_plugin',
						version: '1.0',
					},
				],
			});
		});
	});
});
