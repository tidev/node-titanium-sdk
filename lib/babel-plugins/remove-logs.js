'use strict';

/**
 * The actual Babel plugin definition. This plugin removes Ti.API.debug/trace method calls.
 * @param {object} _ref instance of @babel/types
 * @returns {object} the instance of the plugin used by Babel during transforms
 */
function plugin(_ref) {
	const types = _ref.types;
	return {
		visitor: {
			CallExpression(path, _state) {
				const callee = path.get('callee');
				if (!callee.isMemberExpression()) {
					return;
				}
				if (path.get('callee').matchesPattern('Ti.API.debug')
					|| path.get('callee').matchesPattern('Titanium.API.debug')
					|| path.get('callee').matchesPattern('Titanium.API.trace')
					|| path.get('callee').matchesPattern('Ti.API.trace')) {
					path.replaceWith(types.nullLiteral());
				}
			},
		}
	};
}
module.exports = plugin;
