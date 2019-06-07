/**
 * @overview
 * Analyzes Titanium JavaScript files for symbols and optionally minifies the code.
 *
 * @module lib/jsanalyze
 *
 * @copyright
 * Copyright (c) 2009-Present by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

const appc = require('node-appc');
const path = require('path');
const fs = require('fs-extra');
const DOMParser = require('xmldom').DOMParser;
const babel = require('@babel/core');
const babylon = require('@babel/parser');
const minify = require('babel-preset-minify');
const env = require('@babel/preset-env');
const apiTracker = require('./babel-plugins/ti-api');
const __ = appc.i18n(__dirname).__;

/**
 * Returns an object with the Titanium API usage statistics.
 *
 * @returns {Object} The API usage stats
 */
exports.getAPIUsage = function getAPIUsage() {
	return apiTracker.apiUsage;
};

/**
 * Analyzes a Titanium JavaScript file for all Titanium API symbols.
 *
 * @param {String} file - The full path to the JavaScript file
 * @param {Object} [opts] - Analyze options
 * @param {String} [opts.filename] - The filename of the original JavaScript source
 * @param {Boolean} [opts.minify=false] - If true, minifies the JavaScript and returns it
 * @returns {Object} An object containing symbols and minified JavaScript
 * @throws {Error} An error if unable to parse the JavaScript
 */
exports.analyzeJsFile = function analyzeJsFile(file, opts = {}) {
	opts.filename = file;
	return exports.analyzeJs(fs.readFileSync(file).toString(), opts);
};

/**
 * Analyzes a string containing JavaScript for all Titanium API symbols.
 *
 * @param {String} contents - A string of JavaScript
 * @param {Object} [opts] - Analyze options
 * @param {String} [opts.filename] - The filename of the original JavaScript source
 * @param {Boolean} [opts.minify=false] - If true, minifies the JavaScript and returns it
 * @param {Boolean} [opts.transpile=false] - If true, transpiles the JS code and retuns it
 * @param {Array} [opts.plugins=[]] - An array of resolved Babel plugins
 * @param {Function} [opts.logger] - Logger instance to use for logging warnings.
 * @returns {Object} An object containing symbols and minified JavaScript
 * @throws {Error} An error if unable to parse the JavaScript
 */
exports.analyzeJs = function analyzeJs(contents, opts = {}) {
	opts.plugins || (opts.plugins = []);

	// parse the js file
	let ast;
	const parserOpts = {
		sourceType: 'unambiguous',
		filename: opts.filename
	};
	try {
		try {
			ast = babylon.parse(contents, parserOpts);
		} catch (err) {
			// fall back to much looser parsing
			parserOpts.allowReturnOutsideFunction = true;
			ast = babylon.parse(contents, parserOpts);
		}
	} catch (ex) {
		const errmsg = [ __('Failed to parse %s', opts.filename) ];
		if (ex.line) {
			errmsg.push(__('%s [line %s, column %s]', ex.message, ex.line, ex.col));
		} else {
			errmsg.push(ex.message);
		}
		try {
			contents = contents.split('\n');
			if (ex.line && ex.line <= contents.length) {
				errmsg.push('');
				errmsg.push('    ' + contents[ex.line - 1].replace(/\t/g, ' '));
				if (ex.col) {
					var i = 0,
						len = ex.col,
						buffer = '    ';
					for (; i < len; i++) {
						buffer += '-';
					}
					errmsg.push(buffer + '^');
				}
				errmsg.push('');
			}
		} catch (ex2) {} // eslint-disable-line no-empty
		throw new Error(errmsg.join('\n'));
	}

	const results = {
		original: contents,
		contents: contents,
		symbols: [] // apiTracker plugin will gather these!
	};

	const options = {
		filename: opts.filename,
		retainLines: true,
		presets: [],
		plugins: [
			[ require.resolve('./babel-plugins/global-scope'), { logger: opts.logger } ],
			[ apiTracker, { skipStats: opts.skipStats } ] // track our API usage no matter what
		],
		parserOpts
	};

	// transpile
	if (opts.transpile) {
		options.plugins.push(require.resolve('./babel-plugins/global-this'));
		options.presets.push([ env, { targets: opts.targets } ]);
	}

	// minify
	if (opts.minify) {
		Object.assign(options, {
			minified: true,
			compact: true,
			comments: false
		});

		options.presets.push([ minify, {
			mangle: false,
			deadcode: false
		} ]);

		options.plugins.push(require.resolve('@babel/plugin-transform-property-literals'));
	}

	if (opts.plugins.length) {
		options.plugins.push.apply(options.plugins, opts.plugins);
	}

	// generate a source map
	// we spit out a .map file next to the JS file and append a comment ot the JS code
	// to point at the map file using sourceMappingURL
	if (opts.sourceMap) {
		options.sourceMaps = true;
		options.sourceFileName = opts.filename;
	}

	const transformed = babel.transformFromAstSync(ast, contents, options);
	results.contents = transformed.code;
	if (opts.sourceMap) {
		results.contents += `\n//# sourceMappingURL=${path.basename(opts.dest)}.map`;
		// Drop the sourcesContent property from the map, as the map already contains the filepath of the input source file
		delete transformed.map.sourcesContent;
		// TODO: Do we need to retian the sourcesContent for device builds?
		transformed.map.file = opts.dest; // give it the destination file path as 'file' so Studio and other parsers can handle it
		fs.writeFileSync(opts.dest + '.map', JSON.stringify(transformed.map));
	}
	results.symbols = Array.from(apiTracker.symbols.values()); // convert Set values to Array

	return results;
};

/**
 * Analyzes an HTML file for all app:// JavaScript files
 *
 * @param {String} file - The full path to the HTML file
 * @param {String} [relPath] - A relative path to the HTML file with respect to the Resources directory
 * @returns {Array} An array of app:// JavaScript files
 */
exports.analyzeHtmlFile = function analyzeHtmlFile(file, relPath) {
	return exports.analyzeHtml(fs.readFileSync(file).toString(), relPath);
};

/**
 * Analyzes a string containing JavaScript for all Titanium API symbols.
 *
 * @param {String} contents - A string of JavaScript
 * @param {String} [relPath] - A relative path to the HTML file with respect to the Resources directory
 * @returns {Array} An array of app:// JavaScript files
 */
exports.analyzeHtml = function analyzeHtml(contents, relPath) {
	const files = [];

	function addFile(src) {
		const m = src && src.match(/^(?:(.*):\/\/)?(.+)/);
		let res = m && m[2];
		if (res) {
			if (!m[1]) {
				if (relPath && res.indexOf('/') !== 0) {
					res = relPath.replace(/\/$/, '') + '/' + res;
				}

				// compact the path
				const p = res.split(/\/|\\/);
				const r = [];
				let q;
				while (q = p.shift()) {
					if (q === '..') {
						r.pop();
					} else {
						r.push(q);
					}
				}

				files.push(r.join('/'));
			} else if (m[1] === 'app') {
				files.push(res);
			}
		}
	}

	try {
		const dom = new DOMParser({ errorHandler: function () {} }).parseFromString('<temp>\n' + contents + '\n</temp>', 'text/html'),
			doc = dom && dom.documentElement,
			scripts = doc && doc.getElementsByTagName('script'),
			len = scripts.length;

		if (scripts) {
			for (let i = 0; i < len; i++) {
				const src = scripts[i].getAttribute('src');
				src && addFile(src);
			}
		}
	} catch (e) {
		// bad html file, try to manually parse out the script tags
		contents.split('<script').slice(1).forEach(function (chunk) {
			const p = chunk.indexOf('>');
			if (p !== -1) {
				let m = chunk.substring(0, p).match(/src\s*=\s*['"]([^'"]+)/);
				if (!m) {
					// try again without the quotes
					m = chunk.substring(0, p).match(/src\s*=\s*([^>\s]+)/);
				}
				m && addFile(m[1]);
			}
		});
	}

	return files;
};
