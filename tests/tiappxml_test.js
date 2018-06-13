var ti = require('../lib/titanium'),
	fs = require('fs'),
	path = require('path');

describe('tiappxml', function () {
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
	var tiapp = new ti.tiappxml(path.dirname(module.filename) + '/resources/tiapp1.xml');

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
	var tiapp = new ti.tiappxml(path.dirname(module.filename) + '/resources/tiapp1.xml');

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

	it('tiapp2.xml', function () {
		var xmlPath = path.join(__dirname, 'resources', 'tiapp2.xml'),
			xml = fs.readFileSync(xmlPath).toString(),
			tiapp = new ti.tiappxml(xmlPath);

		tiapp.toString().should.eql('[object Object]');
		(tiapp.toString('json') + '\n').should.eql(fs.readFileSync(path.join(__dirname, 'results', 'tiapp2.json')).toString());
		(tiapp.toString('pretty-json') + '\n').should.eql(fs.readFileSync(path.join(__dirname, 'results', 'tiapp2.pretty.json')).toString());
		// have to ignore newlines, since thye can differ in OS-style
		(tiapp.toString('xml').replace(/(\r\n|\n|\r)/gm, '')).should.eql(fs.readFileSync(path.join(__dirname, 'results', 'tiapp2.xml')).toString().replace(/(\r\n|\n|\r)/gm, ''));
	});

	it('tiapp4.xml', function () {
		var tiapp = new ti.tiappxml(path.join(__dirname, '/resources/tiapp4.xml'));
		tiapp.id.should.eql('ti.testapp');
		tiapp.windows.id.should.eql('com.windows.example');
	});

/*
(function () {
	var tiapp = new ti.tiappxml(path.dirname(module.filename) + '/resources/tiapp3.xml');

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
