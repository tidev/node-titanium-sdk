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

		it('transpile and minify works and transforms async/await when targeting old iOS', function () {
			const results = jsanalyze.analyzeJs('async function other() { return 1; }; async function first() { const result = await other(); return result + 3; };', { transpile: true, minify: true, targets: { ios: 8 } });
			results.contents.should.eql('function asyncGeneratorStep(gen,resolve,reject,_next,_throw,key,arg){try{var info=gen[key](arg),value=info.value}catch(error){return void reject(error)}info.done?resolve(value):Promise.resolve(value).then(_next,_throw)}function _asyncToGenerator(fn){return function(){var self=this,args=arguments;return new Promise(function(resolve,reject){function _next(value){asyncGeneratorStep(gen,resolve,reject,_next,_throw,"next",value)}function _throw(err){asyncGeneratorStep(gen,resolve,reject,_next,_throw,"throw",err)}var gen=fn.apply(self,args);_next(void 0)})}}function other(){return _other.apply(this,arguments)}function _other(){return _other=_asyncToGenerator(regeneratorRuntime.mark(function _callee(){return regeneratorRuntime.wrap(function _callee$(_context){for(;1;)switch(_context.prev=_context.next){case 0:return _context.abrupt("return",1);case 1:case"end":return _context.stop();}},_callee)})),_other.apply(this,arguments)};function first(){return _first.apply(this,arguments)}function _first(){return _first=_asyncToGenerator(regeneratorRuntime.mark(function _callee2(){var result;return regeneratorRuntime.wrap(function _callee2$(_context2){for(;1;)switch(_context2.prev=_context2.next){case 0:return _context2.next=2,other();case 2:return result=_context2.sent,_context2.abrupt("return",result+3);case 4:case"end":return _context2.stop();}},_callee2)})),_first.apply(this,arguments)};');
		});

		it('generates source maps inline into generated js file', function () {
			const inputJSFile = path.join(__dirname, 'resources/input.js');
			const contents = fs.readFileSync(inputJSFile, 'utf-8');
			const expectedSourceMap = fs.readJSONSync(inputJSFile + '.map');
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile);
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
			const expectedSourceMap = fs.readJSONSync(inputJSFile + '.map');
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile);
			delete expectedSourceMap.sourcesContent;
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
			const expectedSourceMap = fs.readJSONSync(path.join(__dirname, 'resources/intermediate.js.map'));
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile); // passes along the original source file via sources/sourceRoot
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
			const expectedSourceMap = fs.readJSONSync(path.join(__dirname, 'resources/intermediate.js.map'));
			expectedSourceMap.sourceRoot = path.dirname(originalSourceFile); // passes along the original source file via sources/sourceRoot
			const expectedBase64Map = Buffer.from(JSON.stringify(expectedSourceMap)).toString('base64');
			results.contents.should.eql(`var myGlobalMethod = function myGlobalMethod() {return this;};\n\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${expectedBase64Map}\n`);
		});

		it('handles input JS file with existing sourceMappingURL pointing to non-existent file', function () {
			// treat like there is no original input source map....
			// only difference here is that there's an extra newline to deal with versus the "base" test case
			const inputJSFile = path.join(__dirname, 'resources/input.nonexistent.sourcemapfile.js');
			const contents = fs.readFileSync(inputJSFile, 'utf-8');
			const expectedSourceMap = fs.readJSONSync(path.join(__dirname, 'resources/input.nonexistent.sourcemapfile.js.map'));
			expectedSourceMap.sourceRoot = path.dirname(inputJSFile);
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
	});
});
