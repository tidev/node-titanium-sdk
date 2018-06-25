/* eslint no-unused-expressions: "off" */
'use strict';

const should = require('should'); // eslint-disable-line no-unused-vars
const i18n = require('../lib/i18n');

describe('i18n', function () {
	it('#load()', function () {
		const result = i18n.load(__dirname);
		result.should.be.an.Object;
		// first language, places values into 'strings' property
		result.should.have.ownProperty('en');
		result.en.should.have.ownProperty('strings');
		result.en.strings.should.have.ownProperty('whatever');
		result.en.strings.whatever.should.eql('value');

		// second language, places app.xml values into 'app' property
		result.should.have.ownProperty('es');
		result.es.should.have.ownProperty('app');
		result.es.app.should.have.ownProperty('whatever');
		result.es.app.whatever.should.eql('my spanish value');
	});
});
