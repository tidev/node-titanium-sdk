/* eslint no-unused-expressions: "off" */
'use strict';

const path = require('path');
const fs = require('fs-extra');
const should = require('should'); // eslint-disable-line no-unused-vars
const jsanalyze = require('../lib/jsanalyze');

function sortObject (o) {
	var sorted = {},
		key,
		a = [];

	for (key in o) {
		a.push(key);
	}

	a.sort();

	for (key = 0; key < a.length; key++) {
		sorted[a[key]] = o[a[key]];
	}
	return sorted;
}

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

		it('Should ignore Ti in string', function () {
			const results = jsanalyze.analyzeJs(`
			Ti.API.info("Ti. In A String Causes Issues?".toUpperCase());
			Ti.API.info(\`Ti.UI.AlertDialog selected button at index: \${index}\`);
			const message = \`Ti.UI.TabbedBar changed to index: \${index}\`;
			const messageAfterTranspile = "Ti.UI.TabbedBar changed to index: ".concat(index);
			const view = Ti.UI.createLabel();
			console.log(\`version is \${Ti.API.version}\`);
			"Ti.Test".toUpperCase();
			Ti['UI'].createWebView();
			"Ti.Test"`, {});
			results.symbols.should.eql([ 'API.info', 'API', 'UI.createLabel', 'UI', 'API.version', 'UI.createWebView' ]);
		});

		it('tracks Ti API usage across multiple calls', function () {
			const results = jsanalyze.analyzeJs('Ti.UI.createView({});', {});
			results.symbols.should.eql([ 'UI.createView', 'UI' ]); // symbols only includes from this call
			// includes symbols from this test and the one above!
			jsanalyze.getAPIUsage().should.eql({
				'Titanium.API': 4,
				'Titanium.API.info': 3,
				'Titanium.API.version': 1,
				'Titanium.UI': 3,
				'Titanium.UI.createLabel': 1,
				'Titanium.UI.createView': 1,
				'Titanium.UI.createWebView': 1
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

		it('generates source maps inline into generated js file', function () {
			const inputJSFile = path.join(__dirname, 'resources/input.js');
			const contents = fs.readFileSync(inputJSFile, 'utf-8');
			var expectedSourceMap = fs.readJSONSync(inputJSFile + '.map');

			expectedSourceMap.sourceRoot = path.dirname(inputJSFile);
			expectedSourceMap = sortObject(expectedSourceMap);

			const results = jsanalyze.analyzeJs(contents,
				{
					transpile: true,
					sourceMap: true,
					filename: inputJSFile
				});
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			results.contents.should.eql(`var myGlobalMethod = function myGlobalMethod() {return this;};\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		it('generates source maps inline into generated js file and removes sourcesContent for android platform', function () {
			const inputJSFile = path.join(__dirname, 'resources/input.js');
			const contents = fs.readFileSync(inputJSFile, 'utf-8');
			var expectedSourceMap = fs.readJSONSync(inputJSFile + '.map');
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile);
			delete expectedSourceMap.sourcesContent;
			expectedSourceMap = sortObject(expectedSourceMap);
			const results = jsanalyze.analyzeJs(contents,
				{
					transpile: true,
					sourceMap: true,
					filename: inputJSFile,
					platform: 'android',
				});
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			results.contents.should.eql(`var myGlobalMethod = function myGlobalMethod() {return this;};\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		it('handles input JS file with existing sourceMappingURL pointing to file', function () {
			const inputMapFile = path.join(__dirname, 'resources/input.js.map');
			const inputJSFile = path.join(__dirname, 'resources/input.js');
			const results = jsanalyze.analyzeJs(`var myGlobalMethod = function() { return this; };\n//# sourceMappingURL=file://${inputMapFile}`,
				{
					transpile: true,
					sourceMap: true,
					filename: 'intermediate.js'
				});
			var expectedSourceMap = fs.readJSONSync(path.join(__dirname, 'resources/intermediate.js.map'));
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile); // passes along the original source file via sources/sourceRoot
			expectedSourceMap = sortObject(expectedSourceMap);
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			results.contents.should.eql(`var myGlobalMethod = function myGlobalMethod() {return this;};\n\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		it('handles input JS file with existing sourceMappingURL with data: uri', function () {
			const originalSourceFile = path.join(__dirname, 'resources/input.js');
			// given that it's inlined, it will try to resolve the relative 'input.js' source as relative to the JS filename we pass along in options.
			const results = jsanalyze.analyzeJs('var myGlobalMethod = function() { return this; };\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImlucHV0LmpzIl0sIm5hbWVzIjpbIm15R2xvYmFsTWV0aG9kIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFJQSxjQUFjLEdBQUcsU0FBakJBLGNBQWlCLEdBQVcsQ0FBRSxPQUFPLElBQVAsQ0FBYyxDQUFoRCIsInNvdXJjZXNDb250ZW50IjpbInZhciBteUdsb2JhbE1ldGhvZCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfTsiXX0=',
				{
					transpile: true,
					sourceMap: true,
					filename: path.join(__dirname, 'resources/intermediate.js')
				});
			var expectedSourceMap = fs.readJSONSync(path.join(__dirname, 'resources/intermediate.js.map'));
			expectedSourceMap.sourceRoot = path.dirname(originalSourceFile); // passes along the original source file via sources/sourceRoot
			expectedSourceMap = sortObject(expectedSourceMap);
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			results.contents.should.eql(`var myGlobalMethod = function myGlobalMethod() {return this;};\n\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		it('handles input JS file with existing sourceMappingURL pointing to non-existent file', function () {
			// treat like there is no original input source map....
			// only difference here is that there's an extra newline to deal with versus the "base" test case
			const inputJSFile = path.join(__dirname, 'resources/input.nonexistent.sourcemapfile.js');
			const contents = fs.readFileSync(inputJSFile, 'utf-8');
			var expectedSourceMap = fs.readJSONSync(path.join(__dirname, 'resources/input.nonexistent.sourcemapfile.js.map'));
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile);
			expectedSourceMap = sortObject(expectedSourceMap);
			const results = jsanalyze.analyzeJs(contents,
				{
					transpile: true,
					sourceMap: true,
					filename: inputJSFile
				});
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			results.contents.should.eql(`var myGlobalMethod = function myGlobalMethod() {return this;};\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		// babel-plugin-transform-titanium
		it('converts OS_IOS into boolean', () => {
			const results = jsanalyze.analyzeJs('if (OS_IOS) {}', { transpile: true, transform: { platform: 'ios' } });
			results.contents.should.eql('if (true) {}');
		});

		it('should fallback to looser parsing if required', () => {
			const results = jsanalyze.analyzeJs('return "foo";');
			results.contents.should.eql('return "foo";');
		});

		it('should handle errors', () => {
			should(() => jsanalyze.analyzeJs('return foo!;console.log("bar");')).throw('Failed to parse undefined\nMissing semicolon. (1:10)');
		});
	});

	describe('#analyzeJsFile()', function () {
		it('should transform contents', function () {
			const inputJSFile = path.join(__dirname, 'resources/input.js');

			var expectedSourceMap = fs.readJSONSync(inputJSFile + '.map');
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile);
			expectedSourceMap = sortObject(expectedSourceMap);
			const results = jsanalyze.analyzeJsFile(inputJSFile,
				{
					transpile: true,
					sourceMap: true
				});
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			results.contents.should.eql(`var myGlobalMethod = function myGlobalMethod() {return this;};\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});
	});

	describe('#analyzeHtml', function () {
		it('should analyze an html file', function () {
			const inputFile = path.join(__dirname, 'resources/hello.html');

			const results = jsanalyze.analyzeHtml(fs.readFileSync(inputFile, 'utf8'));
			results.should.be.an.Array();
			results.length.should.equal(2);
			results.should.deepEqual([
				'input.js',
				'resources/input.js'
			]);
		});
	});

	describe('#analyzeHtmlFile', function () {
		it('should analyze an html file', function () {
			const inputFile = path.join(__dirname, 'resources/hello.html');

			const results = jsanalyze.analyzeHtmlFile(inputFile);
			results.should.be.an.Array();
			results.length.should.equal(2);
			results.should.deepEqual([
				'input.js',
				'resources/input.js'
			]);
		});
	});
});
