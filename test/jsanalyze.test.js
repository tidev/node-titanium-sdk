import { describe, expect, it, before, after } from 'vitest';
import { jsanalyze, sortObject } from '../lib/jsanalyze.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('jsanalyze', () => {
	describe('#analyzeJs()', () => {
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

		it('tracks Ti API symbols', () => {
			const results = jsanalyze.analyzeJs('Ti.API.info("yeah");', {});
			expect(results.symbols).toEqual([ 'API.info', 'API' ]);
		});

		it('Should ignore Ti in string', () => {
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
			expect(results.symbols).toEqual([ 'API.info', 'API', 'UI.createLabel', 'UI', 'API.version', 'UI.createWebView' ]);
		});

		it('tracks Ti API usage across multiple calls', () => {
			const results = jsanalyze.analyzeJs('Ti.UI.createView({});', {});
			expect(results.symbols).toEqual([ 'UI.createView', 'UI' ]); // symbols only includes from this call
			// includes symbols from this test and the one above!
			expect(jsanalyze.getAPIUsage()).toEqual({
				'Titanium.API': 4,
				'Titanium.API.info': 3,
				'Titanium.API.version': 1,
				'Titanium.UI': 3,
				'Titanium.UI.createLabel': 1,
				'Titanium.UI.createView': 1,
				'Titanium.UI.createWebView': 1
			});
		});

		it('converts global "this" references into "global" references when transpiling', () => {
			const results = jsanalyze.analyzeJs('this.myGlobalMethod = function() {};', { transpile: true });
			expect(results.contents).toEqual('global.myGlobalMethod = function () {};');
		});

		it('doesn\'t converts function-scoped "this" references into "global" references when transpiling', () => {
			const results = jsanalyze.analyzeJs('var myGlobalMethod = function() { return this; };', { transpile: true });
			expect(results.contents).toEqual('var myGlobalMethod = function myGlobalMethod() {return this;};');
		});

		it('generates source maps inline into generated js file', () => {
			const inputJSFile = path.join(__dirname, 'resources/input.js');
			const contents = fs.readFileSync(inputJSFile, 'utf-8');
			let expectedSourceMap = JSON.parse(fs.readFileSync(`${inputJSFile}.map`, 'utf8'));

			expectedSourceMap.sourceRoot = path.dirname(inputJSFile);
			expectedSourceMap = sortObject(expectedSourceMap);

			const results = jsanalyze.analyzeJs(contents,
				{
					transpile: true,
					sourceMap: true,
					filename: inputJSFile
				});
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			expect(results.contents).toEqual(`var myGlobalMethod = function myGlobalMethod() {return this;};\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		it('generates source maps inline into generated js file and removes sourcesContent for android platform', () => {
			const inputJSFile = path.join(__dirname, 'resources/input.js');
			const contents = fs.readFileSync(inputJSFile, 'utf-8');
			let expectedSourceMap = JSON.parse(fs.readFileSync(`${inputJSFile}.map`, 'utf8'));
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
			expect(results.contents).toEqual(`var myGlobalMethod = function myGlobalMethod() {return this;};\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		it('handles input JS file with existing sourceMappingURL pointing to file', () => {
			const inputMapFile = path.join(__dirname, 'resources/input.js.map');
			const inputJSFile = path.join(__dirname, 'resources/input.js');
			const results = jsanalyze.analyzeJs(`var myGlobalMethod = function() { return this; };\n//# sourceMappingURL=file://${inputMapFile}`,
				{
					transpile: true,
					sourceMap: true,
					filename: 'intermediate.js'
				});
			let expectedSourceMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'resources/intermediate.js.map'), 'utf8'));
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile); // passes along the original source file via sources/sourceRoot
			expectedSourceMap = sortObject(expectedSourceMap);
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			expect(results.contents).toEqual(`var myGlobalMethod = function myGlobalMethod() {return this;};\n\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		it('handles input JS file with existing sourceMappingURL with data: uri', () => {
			const originalSourceFile = path.join(__dirname, 'resources/input.js');
			// given that it's inlined, it will try to resolve the relative 'input.js' source as relative to the JS filename we pass along in options.
			const results = jsanalyze.analyzeJs('var myGlobalMethod = function() { return this; };\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImlucHV0LmpzIl0sIm5hbWVzIjpbIm15R2xvYmFsTWV0aG9kIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFJQSxjQUFjLEdBQUcsU0FBakJBLGNBQWMsR0FBYyxDQUFFLE9BQU8sSUFBSSxDQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgbXlHbG9iYWxNZXRob2QgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH07Il19',
				{
					transpile: true,
					sourceMap: true,
					filename: path.join(__dirname, 'resources/intermediate.js')
				});
			let expectedSourceMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'resources/intermediate.js.map'), 'utf8'));
			expectedSourceMap.sourceRoot = path.dirname(originalSourceFile); // passes along the original source file via sources/sourceRoot
			expectedSourceMap = sortObject(expectedSourceMap);
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			expect(results.contents).toEqual(`var myGlobalMethod = function myGlobalMethod() {return this;};\n\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		it('handles input JS file with existing sourceMappingURL pointing to non-existent file', () => {
			// treat like there is no original input source map....
			// only difference here is that there's an extra newline to deal with versus the "base" test case
			const inputJSFile = path.join(__dirname, 'resources/input.nonexistent.sourcemapfile.js');
			const contents = fs.readFileSync(inputJSFile, 'utf-8');
			let expectedSourceMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'resources/input.nonexistent.sourcemapfile.js.map'), 'utf8'));
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile);
			expectedSourceMap = sortObject(expectedSourceMap);
			const results = jsanalyze.analyzeJs(contents,
				{
					transpile: true,
					sourceMap: true,
					filename: inputJSFile
				});
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			expect(results.contents).toEqual(`var myGlobalMethod = function myGlobalMethod() {return this;};\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		// babel-plugin-transform-titanium
		it('converts OS_IOS into boolean', () => {
			const results = jsanalyze.analyzeJs('if (OS_IOS) {}', { transpile: true, transform: { platform: 'ios' } });
			expect(results.contents).toEqual('if (true) {}');
		});

		it('should fallback to looser parsing if required', () => {
			const results = jsanalyze.analyzeJs('return "foo";');
			expect(results.contents).toEqual('return "foo";');
		});

		it('should handle errors', () => {
			expect(() => jsanalyze.analyzeJs('return foo!;console.log("bar");')).toThrow('Failed to parse undefined\nUnexpected token, expected ";" (1:10)');
		});
	});

	describe('#analyzeJsFile()', () => {
		it('should transform contents', () => {
			const inputJSFile = path.join(__dirname, 'resources/input.js');

			let expectedSourceMap = JSON.parse(fs.readFileSync(`${inputJSFile}.map`, 'utf8'));
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile);
			expectedSourceMap = sortObject(expectedSourceMap);
			const results = jsanalyze.analyzeJsFile(inputJSFile,
				{
					transpile: true,
					sourceMap: true
				});
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			expect(results.contents).toEqual(`var myGlobalMethod = function myGlobalMethod() {return this;};\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});
	});

	describe('#analyzeHtml', () => {
		it('should analyze an html file', () => {
			const inputFile = path.join(__dirname, 'resources/hello.html');

			const results = jsanalyze.analyzeHtml(fs.readFileSync(inputFile, 'utf8'));
			expect(results).toBeInstanceOf(Array);
			expect(results.length).toEqual(2);
			expect(results).toEqual([
				'input.js',
				'resources/input.js'
			]);
		});
	});

	describe('#analyzeHtmlFile', () => {
		it('should analyze an html file', () => {
			const inputFile = path.join(__dirname, 'resources/hello.html');

			const results = jsanalyze.analyzeHtmlFile(inputFile);
			expect(results).toBeInstanceOf(Array);
			expect(results.length).toEqual(2);
			expect(results).toEqual([
				'input.js',
				'resources/input.js'
			]);
		});
	});
});
