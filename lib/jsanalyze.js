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

const appc = require('node-appc'),
	fs = require('fs'),
	path = require('path'),
	DOMParser = require('xmldom').DOMParser,
	babel = require('babel-core'),
	babylon = require('babylon'),
	types = require('babel-types'),
	traverse = require('babel-traverse').default,
	minify = require('babel-preset-minify'),
	env = require('babel-preset-env'),
	__ = appc.i18n(__dirname).__;

let apiUsage = {};

/**
 * Returns an object with the Titanium API usage statistics.
 *
 * @returns {Object} The API usage stats
 */
exports.getAPIUsage = function getAPIUsage() {
	return apiUsage;
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
exports.analyzeJsFile = function analyzeJsFile(file, opts) {
	opts || (opts = {});
	opts.filename = file;
	return exports.analyzeJs(fs.readFileSync(file).toString(), opts);
};

// Need to look for MemberExpressions, expand them out to full name

function getMemberValue(node) {
	if (types.isIdentifier(node)) {
		return node.name;
	}

	if (types.isStringLiteral(node)) {
		return node.value;
	}

	if (!types.isMemberExpression(node)) {
		return null;
	}

	if (node.computed && !types.isStringLiteral(node.property)) {
		return null;
	}

	const objVal = getMemberValue(node.object);
	if (objVal === null) {
		return null;
	}

	const propVal = getMemberValue(node.property);
	if (propVal === null) {
		return null;
	}
	return objVal + '.' + propVal;
}

function getTitaniumExpression(member) {
	const value = getMemberValue(member);
	if (value === null) {
		return null;
	}

	const tiNodeRegExp = /^Ti(tanium)?/;
	if (tiNodeRegExp.test(value)) {
		// if value.startsWith('Ti.'), replace with 'Titanium.'
		if (value.indexOf('Ti.') === 0) {
			return 'Titanium.' + value.substring(3);
		}
		return value;
	}
	return null;
}

/**
 * Analyzes a string containing JavaScript for all Titanium API symbols.
 *
 * @param {String} contents - A string of JavaScript
 * @param {Object} [opts] - Analyze options
 * @param {String} [opts.filename] - The filename of the original JavaScript source
 * @param {Boolean} [opts.minify=false] - If true, minifies the JavaScript and returns it
 * @param {Boolean} [opts.transpile=false] - If true, transpiles the JS code and retuns it
 * @param {Array} [opts.plugins=[]] - An array of resolved Babel plugins
 * @returns {Object} An object containing symbols and minified JavaScript
 * @throws {Error} An error if unable to parse the JavaScript
 */
exports.analyzeJs = function analyzeJs(contents, opts) {
	opts || (opts = {});
	opts.plugins || (opts.plugins = []);

	// parse the js file
	let ast;
	try {
		ast = babylon.parse(contents, { filename: opts.filename, sourceType: 'module' });
	} catch (ex) {
		var errmsg = [ __('Failed to parse %s', opts.filename) ];
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
		} catch (ex2) {}
		throw new Error(errmsg.join('\n'));
	}

	// find all of the titanium symbols
	let symbols = {};
	traverse(ast, {
		MemberExpression: {
			enter: function (path) {
				var memberExpr = getTitaniumExpression(path.node);
				if (memberExpr) {
					symbols[memberExpr.substring(9)] = 1; // Drop leading 'Titanium.'
					if (!opts.skipStats) {
						if (apiUsage[memberExpr] === undefined) {
							apiUsage[memberExpr] = 1;
						} else {
							apiUsage[memberExpr]++;
						}
					}
				}
			}
		}
	});

	const results = {
		original: contents,
		contents: contents,
		symbols: Object.keys(symbols) // convert the object of symbol names to an array of symbol names
	};

	const options = {
		filename: opts.filename,
		retainLines: true,
		presets: [],
		plugins: []
	};

	// transpile
	if (opts.transpile) {
		options.plugins.push(require.resolve('./global-this'));
		options.plugins.push(require.resolve('babel-plugin-transform-async-to-generator'));
		options.presets.push([ env, { targets: opts.targets, useBuiltIns: true } ]);

		// install polyfill
		if (opts.resourcesDir) {
			const modulesDir = path.join(opts.resourcesDir, 'node_modules');

			// make sure our 'node_modules' directory exists
			if (!fs.existsSync(modulesDir)) {
				fs.mkdirSync(modulesDir);
			}

			// copy over polyfill and its dependencies
			// WARNING: REMEMBER TO UPDATE THIS IF 'babel-polyfill' DEPENDENCIES CHANGE!
			[ 'babel-polyfill', 'core-js', 'regenerator-runtime' ].forEach((moduleName) => {
				const moduleSrcDir = path.dirname(require.resolve(path.join(moduleName, 'package.json'))),
					moduleDstDir = path.join(modulesDir, moduleName);

				// copy over module if it does not exist
				if (!fs.existsSync(moduleDstDir)) {
					appc.fs.copyDirSyncRecursive(moduleSrcDir, moduleDstDir);
				}
			});
		}
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

		options.plugins.push(require.resolve('babel-plugin-transform-property-literals'));
	}

	if (opts.plugins.length) {
		options.plugins.push(...opts.plugins);
	}

	if (options.presets.length || options.plugins.length) {
		// FIXME we can't re-use the ast here, because we traversed it
		results.contents = babel.transform(contents, options).code;
	}

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
