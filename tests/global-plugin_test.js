const path = require('path');
const pluginTester = require('babel-plugin-tester');
const plugin = require('../lib/babel-plugins/global-scope');

pluginTester({
	plugin,
	tests: {
		'exposes declerations as global variables': {
			babelOptions: {
				filename: 'app.js'
			},
			fixture: path.join(__dirname, 'resources', 'global-plugin', 'app.js'),
			outputFixture: path.join(__dirname, 'resources', 'global-plugin', 'output.js'),
		},
		'should only operate on app.js': {
			babelOptions: {
				filename: 'another-file.js'
			},
			fixture: path.join(__dirname, 'resources', 'global-plugin', 'app.js'),
			outputFixture: path.join(__dirname, 'resources', 'global-plugin', 'app.js'),
		}
	}
});
