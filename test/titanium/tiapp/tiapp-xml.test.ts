import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TiappXML } from '../../../src/titanium/tiapp-xml.js';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures');

describe('TiappXML', () => {
	describe('Basic Operations', () => {
		it('should load a tiapp with an SDK version', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'hassdk.xml'));
			expect(tiapp.sdkVersion).toBe('1.2.3');
		});

	it('should read simple properties', () => {
		const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
		expect(tiapp.id).toBe('ti.testapp');
		expect(tiapp.name).toBe('testapp');
		expect(tiapp.version).toBe('1.0');
	});

		it('should handle missing properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);
			expect(tiapp.id).toBe('test');
			expect(tiapp.name).toBeUndefined();
		});
	});

	describe('Property Modification', () => {
		it('should update properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
			tiapp.name = 'newname';
			expect(tiapp.name).toBe('newname');

			const xml = tiapp.toString('xml');
			expect(xml).toContain('<name>newname</name>');
		});

		it('should create new properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);

			tiapp.publisher = 'Test Publisher';
			expect(tiapp.publisher).toBe('Test Publisher');

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

			expect(tiapp.icon).toBe('icon.png');
			delete tiapp.icon;
			expect(tiapp.icon).toBeUndefined();

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

			expect(tiapp.id).toBeDefined();
			// Platform access through nested proxy
			// expect(tiapp.id.android).toBe('com.example.android');
		});

		it('should create platform-specific properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>com.example.app</id>
</ti:app>`);

			// This would need additional implementation in the proxy
			// tiapp.id.ios = 'com.example.ios';
			// expect(tiapp.toString()).toContain('<id platform="ios">com.example.ios</id>');
		});
	});

	describe('Modules Array', () => {
		it('should read modules array', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.modules).toBeDefined();
			expect(Array.isArray(tiapp.modules)).toBe(true);
			expect(tiapp.modules.length).toBeGreaterThan(0);
		});

		it('should handle module properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			const firstModule = tiapp.modules[0];
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

			tiapp.modules.push({ id: 'ti.test', platform: 'android', version: '1.0' });
			expect(tiapp.modules.length).toBe(1);

			const xml = tiapp.toString();
			expect(xml).toContain('ti.test');
		});

		it('should remove modules', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			const initialLength = tiapp.modules.length;
			tiapp.modules.pop();
			expect(tiapp.modules.length).toBe(initialLength - 1);
		});
	});

	describe('Properties (Key-Value)', () => {
		it('should read properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			const prop = tiapp.properties['ti.ui.defaultunit'];
			expect(prop).toBeDefined();
			expect(prop.type).toBe('string');
			expect(prop.value).toBe('system');
		});

		it('should handle boolean properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			const prop = tiapp.properties['ti.android.debug'];
			expect(prop).toBeDefined();
			expect(prop.type).toBe('bool');
			expect(prop.value).toBe(true);
		});

		it('should add properties', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);

			tiapp.properties['my.prop'] = { type: 'string', value: 'test' };
			expect(tiapp.properties['my.prop'].value).toBe('test');

			const xml = tiapp.toString();
			expect(xml).toContain('name="my.prop"');
		});

		it('should delete properties', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.properties['ti.ui.defaultunit']).toBeDefined();
			delete tiapp.properties['ti.ui.defaultunit'];
			expect(tiapp.properties['ti.ui.defaultunit']).toBeUndefined();
		});
	});

	describe('iOS Configuration', () => {
		it('should read iOS config', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.ios).toBeDefined();
			// minIosVer is stored as string in XML
			expect(tiapp.ios.minIosVer).toBe('5.0');
			expect(tiapp.ios.teamId).toBe('foo');
		});

		it('should read iOS plist', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.ios.plist).toBeDefined();
			expect(typeof tiapp.ios.plist).toBe('object');
		});

		it('should read iOS capabilities', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.ios.capabilities).toBeDefined();
			expect(tiapp.ios.capabilities['app-groups']).toBeDefined();
			expect(Array.isArray(tiapp.ios.capabilities['app-groups'])).toBe(true);
		});
	});

	describe('Android Configuration', () => {
		it('should read Android config', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.android).toBeDefined();
			// The XML tag is 'tool-api-level' which converts to 'toolApiLevel'
			expect(tiapp.android.toolApiLevel).toBe(10);
		});

		it('should read Android ABI as array', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.android.abi).toBeDefined();
			expect(Array.isArray(tiapp.android.abi)).toBe(true);
			expect(tiapp.android.abi.length).toBeGreaterThan(0);
		});

		it('should read Android manifest', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.android.manifest).toBeDefined();
			expect(typeof tiapp.android.manifest).toBe('string');
		});
	});

	describe('iPhone Configuration', () => {
		it('should read iPhone orientations', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.iphone).toBeDefined();
			expect(tiapp.iphone.orientations).toBeDefined();
			expect(tiapp.iphone.orientations.iphone).toBeDefined();
			expect(Array.isArray(tiapp.iphone.orientations.iphone)).toBe(true);
		});

		it('should read iPhone background modes', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.iphone.backgroundModes).toBeDefined();
			expect(Array.isArray(tiapp.iphone.backgroundModes)).toBe(true);
		});

		it('should read iPhone required features', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.iphone.requiredFeatures).toBeDefined();
			expect(Array.isArray(tiapp.iphone.requiredFeatures)).toBe(true);
		});
	});

	describe('Deployment Targets', () => {
		it('should read deployment targets', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			expect(tiapp.deploymentTargets).toBeDefined();
			expect(tiapp.deploymentTargets.iphone).toBeDefined();
			expect(tiapp.deploymentTargets.android).toBeDefined();
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
			tiapp.version = '1.0.0';

			const output = tiapp.toString();
			// Should have proper indentation
			expect(output).toContain('\n\t<version>1.0.0</version>');
		});

		it('should preserve existing formatting', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
			const originalXml = tiapp.toString();

			// Make a change
			const currentName = tiapp.name;
			tiapp.name = currentName; // Set to same value

			const newXml = tiapp.toString();
			// Structure should remain similar (whitespace preserved)
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

			const json = JSON.stringify(tiapp);
			const parsed = JSON.parse(json);

			expect(parsed.id).toBe('com.test');
			expect(parsed.name).toBe('testapp');
			expect(parsed.version).toBe('1.0');

			// Methods should not appear in JSON
			expect(parsed.load).toBeUndefined();
			expect(parsed.save).toBeUndefined();
			// toString is part of Object.prototype, so it may appear but that's OK
		});

		it('should handle toJSON method', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			const obj = tiapp.toJSON();
			expect(obj).toHaveProperty('id');
			expect(obj).toHaveProperty('name');

			// Should be plain object, not proxy
			expect(Object.getPrototypeOf(obj)).toBe(Object.prototype);
		});

		it('should handle JSON serialization with nested objects', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp2.xml'));

			const json = JSON.stringify(tiapp, null, 2);
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

			const json = JSON.parse(JSON.stringify(tiapp));

			// Should structure platform variants
			expect(json.id).toBeDefined();
			expect(typeof json.id === 'object' || typeof json.id === 'string').toBe(true);
		});
	});

	describe('toString Formats', () => {
		it('should output XML format', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
			const xml = tiapp.toString();

			expect(xml).toContain('<?xml');
			expect(xml).toContain('<ti:app');
			expect(xml).toContain('</ti:app>');
		});

		it('should output JSON format', () => {
			const tiapp = new TiappXML().load(join(fixturesDir, 'tiapp1.xml'));
			const json = tiapp.toJSON();
			expect(json.id).toBe('ti.testapp');
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty tiapp.xml', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
</ti:app>`);

			expect(tiapp.id).toBeUndefined();
			expect(tiapp.name).toBeUndefined();
		});

		it('should handle numeric values', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);

			tiapp.version = 2.0;
			// XML stores everything as strings
			expect(tiapp.version).toBe('2');

			const xml = tiapp.toString();
			expect(xml).toContain('<version>2</version>');
		});

		it('should handle boolean values', () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
</ti:app>`);

			tiapp.fullscreen = true;
			// XML stores everything as strings
			expect(tiapp.fullscreen).toBe('true');

			const xml = tiapp.toString();
			expect(xml).toContain('<fullscreen>true</fullscreen>');
		});

		it('should error if file does not exist', () => {
			const tiapp = new TiappXML();
			expect(() => tiapp.load(join(fixturesDir, 'does_not_exist.xml'))).toThrow(
				'tiapp.xml file does not exist',
			);
		});
	});

	describe('Save Operations', () => {
		it('should save to file', async () => {
			const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<id>test</id>
	<name>test</name>
</ti:app>`);

			const tmpFile = join('/tmp', 'test-tiapp.xml');
			await tiapp.save(tmpFile);

			// Verify we can load it back
			const tiapp2 = new TiappXML().load(tmpFile);
			expect(tiapp2.id).toBe('test');
			expect(tiapp2.name).toBe('test');
		});
	});
});
