import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TiappXML } from '../../../src/titanium/tiapp-xml.js';
import { rm } from 'node:fs/promises';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures');

describe('TiappXML', () => {
	describe('Basic Operations', () => {
		it('should handle missing properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);
			const data = tiapp.data();
			expect(data.id).toBe('test');
			expect(data.name).toBeUndefined();
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

			expect(data.id).toEqual({ default: 'com.example.app', android: 'com.example.android' });
		});

		it('should create platform-specific properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>com.example.app</id>
</ti:app>`);

			const data = tiapp.data();
			data.id = { default: 'com.example.app', ios: 'com.example.ios' };
			tiapp.apply(data);

			expect(tiapp.data().id).toEqual({ default: 'com.example.app', ios: 'com.example.ios' });
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

			const prop = data.properties!['ti.ui.defaultunit'];
			expect(prop).toBeDefined();
			expect(prop.type).toBe('string');
			expect(prop.value).toBe('system');
		});

		it('should handle boolean properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));
			const data = tiapp.data();

			const prop = data.properties!['ti.android.debug'];
			expect(prop).toBeDefined();
			expect(prop.type).toBe('bool');
			expect(prop.value).toBe(true);
		});

		it('should add properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);

			const data = tiapp.data();
			data.properties = data.properties || {};
			data.properties['my.prop'] = { type: 'string', value: 'test' };
			tiapp.apply(data);

			expect(tiapp.data().properties!['my.prop'].value).toBe('test');

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
			expect(typeof data.ios!.plist).toBe('object');
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
				'tiapp.xml file does not exist',
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
				'tiapp.xml file does not exist',
			);
		});

		it('should error if file is not a valid XML file', () => {
			const tiapp = new TiappXML();
			expect(() => tiapp.load(join(fixturesDir, 'invalid.xml'))).toThrow(
				'Invalid XML file',
			);
		});
	});

	describe('Sample Files', () => {
		it('should load a tiapp with an SDK version', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'hassdk.xml'));
			const data = tiapp.data();
			expect(data.sdkVersion).toBe('1.2.3');
		});

		it('should read simple properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
			const data = tiapp.data();
			expect(data.id).toBe('ti.testapp');
			expect(data.name).toBe('testapp');
			expect(data.version).toBe('1.0');
			expect(data.publisher).toBe('tester');
			expect(data.url).toBe('https://titaniumsdk.com');
			expect(data.description).toBe('not specified');
			expect(data.copyright).toBe('2022 by tester');
			expect(data.icon).toBe('appicon.png');
			expect(data.persistentWifi).toBe(false);
			expect(data.prerenderedIcon).toBe(false);
			expect(data.statusbarStyle).toBe('default');
			expect(data.statusbarHidden).toBe(false);
			expect(data.guid).toBe('088dc83c-64af-4a81-b57c-7407649453f0');
			expect(data.modules).toBeDefined();
			expect(Array.isArray(data.modules)).toBe(true);
			expect(data.modules!.length).toBe(0);
			expect(data.android).toBeDefined();
		});
	});
});
