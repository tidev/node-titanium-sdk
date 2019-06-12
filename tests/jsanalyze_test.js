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

		it('generates source maps inline js file', function () {
			const inputJSFile = path.join(__dirname, 'resources/input.js');
			const results = jsanalyze.analyzeJs('var myGlobalMethod = function() { return this; };',
				{
					transpile: true,
					sourceMap: true,
					filename: inputJSFile
				});
			// eslint-disable-next-line max-len
			results.contents.should.eql(`var myGlobalMethod = function myGlobalMethod() {return this;};\n//# sourceURL=file://${inputJSFile}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImlucHV0LmpzIl0sIm5hbWVzIjpbIm15R2xvYmFsTWV0aG9kIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFJQSxjQUFjLEdBQUcsU0FBakJBLGNBQWlCLEdBQVcsQ0FBRSxPQUFPLElBQVAsQ0FBYyxDQUFoRCIsInNvdXJjZXNDb250ZW50IjpbInZhciBteUdsb2JhbE1ldGhvZCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfTsiXX0=\n`);
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
			// eslint-disable-next-line max-len
			results.contents.should.eql(`var myGlobalMethod = function myGlobalMethod() {return this;};\n\n//# sourceURL=file://${inputJSFile}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImlucHV0LmpzIl0sIm5hbWVzIjpbIm15R2xvYmFsTWV0aG9kIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFJQSxjQUFjLEdBQWRBLFNBQUFBLGNBQUFBLEdBQUFBLENBQUFBLE9BQUFBLElBQUFBLENBQUosQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbInZhciBteUdsb2JhbE1ldGhvZCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfTsiXX0=\n`);
		});

		it('handles input JS file with existing sourceMappingURL with data: uri', function () {
			// given that it's inlined, it will try to resolve the relative 'input.js' source as relative to the JS filename we pass along in options.
			const inputJSFile = path.join(__dirname, 'resources/input.js');
			const results = jsanalyze.analyzeJs('var myGlobalMethod = function() { return this; };\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImlucHV0LmpzIl0sIm5hbWVzIjpbIm15R2xvYmFsTWV0aG9kIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFJQSxjQUFjLEdBQUcsU0FBakJBLGNBQWlCLEdBQVcsQ0FBRSxPQUFPLElBQVAsQ0FBYyxDQUFoRCIsInNvdXJjZXNDb250ZW50IjpbInZhciBteUdsb2JhbE1ldGhvZCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfTsiXX0=',
				{
					transpile: true,
					sourceMap: true,
					filename: path.join(__dirname, 'resources/intermediate.js')
				});
			// eslint-disable-next-line max-len
			results.contents.should.eql(`var myGlobalMethod = function myGlobalMethod() {return this;};\n\n//# sourceURL=file://${inputJSFile}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImlucHV0LmpzIl0sIm5hbWVzIjpbIm15R2xvYmFsTWV0aG9kIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFJQSxjQUFjLEdBQWRBLFNBQUFBLGNBQUFBLEdBQUFBLENBQUFBLE9BQUFBLElBQUFBLENBQUosQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbInZhciBteUdsb2JhbE1ldGhvZCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfTsiXX0=\n`);
		});

	});
});
