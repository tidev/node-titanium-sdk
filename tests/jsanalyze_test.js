'use strict';

const should = require('should'); // eslint-disable-line no-unused-vars
const jsanalyze = require('../lib/jsanalyze');

describe('jsanalyze', function () {
	it('#analyzeJs() converts global "this" references into "global" references when transpiling', function () {
		const results = jsanalyze.analyzeJs('this.myGlobalMethod = function() {};', { transpile: true });
		results.contents.should.eql('"use strict";global.myGlobalMethod = function () {};');
	});
});
