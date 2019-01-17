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
const fs = require('fs-extra');
const path = require('path');
const DOMParser = require('xmldom').DOMParser;
const babel = require('@babel/core');
const babylon = require('@babel/parser');
const types = require('@babel/types');
const traverse = require('@babel/traverse').default;
const minify = require('babel-preset-minify');
const env = require('@babel/preset-env');
const __ = appc.i18n(__dirname).__;

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
 * Given an npm module id, this will copy it and it's dependencies to a
 * destination "node_modules" folder.
 * Note that all of the packages are copied to the top-level of "node_modules",
 * not nested!
 * Also, to shortcut the logic, if the original package has been copied to the
 * destination we will *not* attempt to read it's dependencies and ensure those
 * are copied as well! So if the modules version changes or something goes
 * haywire and the copies aren't full finished due to a failure, the only way to
 * get right is to clean the destination "node_modules" dir before rebuilding.
 *
 * @param  {String} moduleId           The npm package/module to copy (along with it's dependencies)
 * @param  {String} destNodeModulesDir path to the destination "node_mdoules" folder
 * @param  {Array}  [paths=[]]         Array of additional paths to pass to require.resolve() (in addition to those from require.resolve.paths(moduleId))
 */
function copyPackageAndDependencies(moduleId, destNodeModulesDir, paths = []) {
	const destPackage = path.join(destNodeModulesDir, moduleId);
	if (fs.existsSync(path.join(destPackage, 'package.json'))) {
		return; // if the module seems to exist in the destination, just skip it.
	}

	// copy the dependency's folder over
	let pkgJSONPath;
	if (require.resolve.paths) {
		const thePaths = require.resolve.paths(moduleId);
		pkgJSONPath = require.resolve(path.join(moduleId, 'package.json'), { paths: thePaths.concat(paths) });
	} else {
		pkgJSONPath = require.resolve(path.join(moduleId, 'package.json'));
	}
	const srcPackage = path.dirname(pkgJSONPath);
	const srcPackageNodeModulesDir = path.join(srcPackage, 'node_modules');
	for (let i = 0; i < 3; i++) {
		fs.copySync(srcPackage, destPackage, {
			preserveTimestamps: true,
			filter: src => !src.startsWith(srcPackageNodeModulesDir)
		});

		// Quickly verify package copied, I've experienced occurences where it does not.
		// Retry up to three times if it did not copy correctly.
		if (fs.existsSync(path.join(destPackage, 'package.json'))) {
			break;
		}
	}

	// Now read it's dependencies and recurse on them
	const packageJSON = fs.readJSONSync(pkgJSONPath);
	for (const dependency in packageJSON.dependencies) {
		copyPackageAndDependencies(dependency, destNodeModulesDir, [ srcPackageNodeModulesDir ]);
	}
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
 * @param {Function} [opts.logger] - Logger instance to use for logging warnings.
 * @returns {Object} An object containing symbols and minified JavaScript
 * @throws {Error} An error if unable to parse the JavaScript
 */
exports.analyzeJs = function analyzeJs(contents, opts) {
	opts || (opts = {});
	opts.plugins || (opts.plugins = []);

	// parse the js file
	let ast;
	try {
		ast = babylon.parse(contents, { filename: opts.filename, sourceType: 'unambiguous' });
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
		} catch (ex2) {} // eslint-disable-line no-empty
		throw new Error(errmsg.join('\n'));
	}

	// find all of the titanium symbols
	const symbols = {};
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
		plugins: [
			[ require.resolve('./babel-plugins/global-scope'), { logger: opts.logger } ]
		],
		parserOpts: {
			sourceType: 'unambiguous'
		}
	};

	// transpile
	if (opts.transpile) {
		options.plugins.push(require.resolve('./babel-plugins/global-this'));
		options.plugins.push(require.resolve('@babel/plugin-transform-async-to-generator'));
		options.presets.push([ env, {
			targets: opts.targets,
			useBuiltIns: 'usage',
			// DO NOT include web polyfills!
			exclude: [ 'web.dom.iterable', 'web.immediate', 'web.timers' ]
		} ]);

		// install polyfill
		if (opts.resourcesDir) {
			const modulesDir = path.join(opts.resourcesDir, 'node_modules');

			// make sure our 'node_modules' directory exists
			if (!fs.existsSync(modulesDir)) {
				fs.mkdirSync(modulesDir);
			}

			// copy over polyfill and its dependencies
			copyPackageAndDependencies('@babel/polyfill', modulesDir);
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

		options.plugins.push(require.resolve('@babel/plugin-transform-property-literals'));
	}

	if (opts.plugins.length) {
		options.plugins.push.apply(options.plugins, opts.plugins);
	}

	// generate and inline source map
	// we inline the source map as the map cannot be retreived from the device
	// using the inspector protocol. only parsed .js files can be retreived.
	if (opts.sourceMap) {
		options.sourceMaps = 'inline';
	}

	// FIXME we can't re-use the ast here, because we traversed it
	results.contents = babel.transformSync(contents, options).code;

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
