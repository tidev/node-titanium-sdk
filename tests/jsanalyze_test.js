/* eslint no-unused-expressions: "off" */
'use strict';

const path = require('path');
const fs = require('fs-extra');
const should = require('should'); // eslint-disable-line no-unused-vars
const jsanalyze = require('../lib/jsanalyze');

describe('jsanalyze', function () {
	describe('#analyzeJs()', function () {
		const tmpDir = path.join(__dirname, 'tmp');

		before(function (finish) {
			if (fs.existsSync(tmpDir)) {
				fs.removeSync(tmpDir);
			}
			fs.ensureDir(tmpDir, finish);
		});

		after(function (finish) {
			fs.remove(tmpDir, finish);
		});

		it('tracks Ti API symbols', function () {
			const results = jsanalyze.analyzeJs('Ti.API.info("yeah");', {});
			results.symbols.should.eql([ 'API.info', 'API' ]);
		});

		it('tracks Ti API usage across multiple calls', function () {
			const results = jsanalyze.analyzeJs('Ti.UI.createView({});', {});
			results.symbols.should.eql([ 'UI.createView', 'UI' ]); // symbols only includes from this call
			// includes symbols from this test and the one above!
			jsanalyze.getAPIUsage().should.eql({
				'Titanium.API.info': 1,
				'Titanium.API': 1,
				'Titanium.UI.createView': 1,
				'Titanium.UI': 1
			});
		});

		it('converts global "this" references into "global" references when transpiling', function () {
			const results = jsanalyze.analyzeJs('this.myGlobalMethod = function() {};', { transpile: true });
			results.contents.should.eql('global.myGlobalMethod = function () {};');
		});

		it('doesn\'t converts function-scoped "this" references into "global" references when transpiling', function () {
			const results = jsanalyze.analyzeJs('var myGlobalMethod = function() { return this; };', { transpile: true });
			results.contents.should.eql('var myGlobalMethod = function myGlobalMethod() {return this;};');
		});

		it('handles polyfilling implicitly under the hood', function () {
			this.timeout(5000);
			this.slow(2000);
			const results = jsanalyze.analyzeJs('const result = Array.from(1, 2, 3);', { transpile: true, resourcesDir: tmpDir });
			results.contents.should.eql('require("core-js/modules/es6.string.iterator");require("core-js/modules/es6.array.from");var result = Array.from(1, 2, 3);');
			// Verify that core-js, @babel/polyfill, regenerator-runtime are copied over!
			fs.existsSync(path.join(tmpDir, 'node_modules', '@babel', 'polyfill')).should.eql.true;
			fs.existsSync(path.join(tmpDir, 'node_modules', '@babel', 'polyfill', 'node_modules', 'core-js')).should.eql.false;
			fs.existsSync(path.join(tmpDir, 'node_modules', 'core-js')).should.eql.true;
			fs.existsSync(path.join(tmpDir, 'node_modules', 'regenerator-runtime')).should.eql.true;
		});

		it('does not inject web polyfills', function () {
			const results = jsanalyze.analyzeJs('Object.getOwnPropertyNames({}).forEach(function (name) {properties[name] = this[name];});', { transpile: true, targets: { ios: 8 }, resourcesDir: tmpDir });
			// DOES NOT CONTAIN require of web.dom.iterable!
			results.contents.should.eql('Object.getOwnPropertyNames({}).forEach(function (name) {properties[name] = this[name];});');
		});
	});
});
