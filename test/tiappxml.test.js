import { describe, expect, it } from 'vitest';
import { tiappxml } from '../lib/tiappxml.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('tiappxml', () => {
/*
(function () {
	var tiapp = new ti.tiappxml();

	console.log('\nCreating empty tiapp.xml');
	console.log('toString():')
	console.log(tiapp.toString());
	console.log('\nJSON:')
	console.log(tiapp.toString('json'));
	console.log('\nPretty JSON:')
	console.log(tiapp.toString('pretty-json'));
	console.log('\nXML:');
	console.log(tiapp.toString('xml'));
}());

(function () {
	var tiapp = new ti.tiappxml();

	tiapp.id = 'com.another.app';
	tiapp.name = 'Another App';
	tiapp.version = '2.0';
	tiapp['deployment-targets'] = { android: false, iphone: true, mobileweb: true };
	tiapp['sdk-version'] = '2.2.0';
	tiapp.properties = {
		prop1: 'value1',
		prop2: 'value2',
		prop3: 'value3',
		prop4: 'value4'
	};

	console.log('\nCreating empty tiapp.xml and adding new nodes');
	console.log('toString():')
	console.log(tiapp.toString());
	console.log('\nJSON:')
	console.log(tiapp.toString('json'));
	console.log('\nPretty JSON:')
	console.log(tiapp.toString('pretty-json'));
	console.log('\nXML:');
	console.log(tiapp.toString('xml'));
}());

(function () {
	var tiapp = new ti.tiappxml(path.dirname(fileURLToPath(import.meta.url)) + '/resources/tiapp1.xml');

	console.log('\nReading tiapp1.xml');
	console.log('toString():')
	console.log(tiapp.toString());
	console.log('\nJSON:')
	console.log(tiapp.toString('json'));
	console.log('\nPretty JSON:')
	console.log(tiapp.toString('pretty-json'));
	console.log('\nXML:');
	console.log(tiapp.toString('xml'));
}());

(function () {
	var tiapp = new ti.tiappxml(path.dirname(fileURLToPath(import.meta.url)) + '/resources/tiapp1.xml');

	tiapp.id = 'com.another.app';
	tiapp.name = 'Another App';
	tiapp.version = '2.0';
	tiapp['deployment-targets'] = { android: false, iphone: true, mobileweb: true };
	tiapp['sdk-version'] = '2.2.0';

	console.log('\nReading tiapp1.xml and modifying nodes');
	console.log('toString():')
	console.log(tiapp.toString());
	console.log('\nJSON:')
	console.log(tiapp.toString('json'));
	console.log('\nPretty JSON:')
	console.log(tiapp.toString('pretty-json'));
	console.log('\nXML:');
	console.log(tiapp.toString('xml'));
}());
*/

	it('tiapp2.xml', () => {
		const xmlPath = path.join(__dirname, 'resources', 'tiapp2.xml');
		const tiapp = new tiappxml(xmlPath);

		expect(tiapp.toString()).toBe('[object Object]');
		expect(tiapp.toString('json') + '\n').toBe(fs.readFileSync(path.join(__dirname, 'results', 'tiapp2.json')).toString());
		expect(tiapp.toString('pretty-json') + '\n').toBe(fs.readFileSync(path.join(__dirname, 'results', 'tiapp2.pretty.json')).toString());
		// have to ignore newlines, since thye can differ in OS-style
		expect(tiapp.toString('xml').replace(/(\r\n|\n|\r)/gm, '')).toBe(fs.readFileSync(path.join(__dirname, 'results', 'tiapp2.xml')).toString().replace(/(\r\n|\n|\r)/gm, ''));
	});

	it('tiapp4.xml', () => {
		const tiapp = new tiappxml(path.join(__dirname, '/resources/tiapp4.xml'));
		expect(tiapp.id).toBe('ti.testapp');
	});

	it('should throw if file does not exist', () => {
		expect(() => new tiappxml('foo')).toThrow('tiapp.xml file does not exist');
	});

	it('should support parsing a tiapp from a string', () => {
		const contents = fs.readFileSync(path.join(__dirname, 'resources', 'tiapp2.xml'), 'utf8');
		const tiapp = new tiappxml();
		tiapp.parse(contents);
		expect(tiapp.toString('json') + '\n').toBe(fs.readFileSync(path.join(__dirname, 'results', 'tiapp2.json')).toString());
	});
/*
(function () {
	var tiapp = new ti.tiappxml(path.dirname(fileURLToPath(import.meta.url)) + '/resources/tiapp3.xml');

	console.log('\nReading tiapp3.xml');
	console.log('toString():')
	console.log(tiapp.toString());
	console.log('\nJSON:')
	console.log(tiapp.toString('json'));
	console.log('\nPretty JSON:')
	console.log(tiapp.toString('pretty-json'));
	console.log('\nXML:');
	console.log(tiapp.toString('xml'));
	console.log('\Original:');
	console.log(fs.readFileSync(__dirname + '/resources/tiapp3.xml').toString());
}());
*/
});
