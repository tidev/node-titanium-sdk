'use strict';
const _path = require('path');
/**
 * Convert all top level variable declarations in "app.js" into explictly
 * defined variables on the global scope.
 */
module.exports = function (babel) {
	const t = babel.types;
	let didEdits = false;
	return {
		name: 'app.js top level variables global transform',
		visitor: {
			Program: function (path, state) {
				const logger = state.opts.logger;
				if (_path.basename(this.file.opts.filename) !== 'app.js') {
					return;
				}
				for (const bodyPath of path.get('body')) {
					for (const name in t.getBindingIdentifiers(bodyPath.node, false, true)) {
						didEdits = true;
						bodyPath.insertAfter(
							t.expressionStatement(
								t.assignmentExpression(
									'=',
									t.identifier(`global.${name} `),
									t.identifier(`${name}`)
								)
							)
						);
					}
				}
				if (didEdits) {
					logger && logger.warn('The implicit global scope for variable declarations in app.js is deprecated in 7.5.0, and will be removed in 9.0.0');
				}
			}
		}
	};
};
