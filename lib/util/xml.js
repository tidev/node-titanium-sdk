/**
 * @constant {Number} Node type constant for an element node.
 */
export const ELEMENT_NODE = 1;

/**
 * Loops through all child element nodes for a given XML node skipping all
 * non-element nodes (i.e. text, comment, etc) and calls the specified function
 * for each element node found.
 * @param {Object} node - An XML node
 * @param {Function} fn - The function to call for each element node found
 */
export function forEachElement(node, fn) {
	let child = node.firstChild;
	while (child) {
		if (child.nodeType === ELEMENT_NODE) {
			fn(child);
		}
		child = child.nextSibling;
	}
};

/**
 * Loops through all attributes for a given DOM node and calls a function for
 * each attribute.
 * @param {Object} node - An XML node
 * @param {Function} fn - The function to call for each attribute
 */
export function forEachAttr(node, fn) {
	const len = node.attributes.length;
	for (let i = 0; i < len; i++) {
		fn(node.attributes.item(i));
	}
};

/**
 * Parses a XML value and converts the value to a JS value if it detects it as a
 * boolean, null, or a number.
 * @param {String} value - The value of the XML node
 * @returns {String|Number|Boolean|Null} The parsed value
 */
export function parse(value) {
	const num = value && String(value).startsWith('0x') ? value : Number(value);
	if (value === '' || typeof value !== 'string' || isNaN(num)) {
		value = value == undefined ? '' : value.toString().trim(); // eslint-disable-line eqeqeq
		if (value === 'null') {
			value = null;
		} else if (value === 'true') {
			value = true;
		} else if (value === 'false') {
			value = false;
		}
		return value;
	}
	return num;
};

/**
 * Gets and parses an attribute of an XML node. If attribute does not exist, it
 * returns an empty string.
 * @param {Object} node - An XML node
 * @param {String} attr - The name of the attribute to get
 * @returns {String|Number|Boolean|Null} The value of the attribute or empty
 *          string if attribute does not exist
 */
export function getAttr(node, attr) {
	return node && parse(node.getAttribute(attr));
};

/**
 * Determines if the specified XML node has a child data node and returns it.
 * @param {Object} node - An XML node
 * @returns {String} The value of the XML node
 */
export function getValue(node) {
	return node && node.firstChild ? parse(node.firstChild.data) : '';
};
