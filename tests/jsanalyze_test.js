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

		it('converts global "this" references into "global" references when transpiling', function () {
			const results = jsanalyze.analyzeJs('this.myGlobalMethod = function() {};', { transpile: true });
			results.contents.should.eql('global.myGlobalMethod = function () {};');
		});

		it('doesn\'t converts function-scoped "this" references into "global" references when transpiling', function () {
			const results = jsanalyze.analyzeJs('var myGlobalMethod = function() { return this; };', { transpile: true });
			results.contents.should.eql('var myGlobalMethod = function myGlobalMethod() {return this;};');
		});

		it('handles polyfilling implicitly under the hood', function () {
			const results = jsanalyze.analyzeJs('const result = Array.from(1, 2, 3);', { transpile: true, resourcesDir: tmpDir });
			results.contents.should.eql('require("core-js/modules/es6.string.iterator");require("core-js/modules/es6.array.from");var result = Array.from(1, 2, 3);');
			// Verify that core-js, @babel/polyfill, regenerator-runtime are copied over!
			fs.existsSync(path.join(tmpDir, 'node_modules', '@babel', 'polyfill')).should.eql.true;
			fs.existsSync(path.join(tmpDir, 'node_modules', '@babel', 'polyfill', 'node_modules', 'core-js')).should.eql.false;
			fs.existsSync(path.join(tmpDir, 'node_modules', 'core-js')).should.eql.true;
			fs.existsSync(path.join(tmpDir, 'node_modules', 'regenerator-runtime')).should.eql.true;
		});
	});
});
