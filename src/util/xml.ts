/**
 * @constant {Number} Node type constant for an element node.
 */
export const ELEMENT_NODE = 1;

/**
 * Loops through all child element nodes for a given XML node skipping all
 * non-element nodes (i.e. text, comment, etc) and calls the specified function
 * for each element node found.
 * @param node - An XML node
 * @param fn - The function to call for each element node found
 */
export function forEachElement(node: Element, fn: (child: Element) => void): void {
	let child = node.firstChild;
	while (child) {
		if (child.nodeType === ELEMENT_NODE) {
			fn(child as Element);
		}
		child = child.nextSibling;
	}
}

/**
 * Loops through all attributes for a given DOM node and calls a function for
 * each attribute.
 * @param node - An XML node
 * @param fn - The function to call for each attribute
 */
export function forEachAttr(node: Element, fn: (attr: Attr) => void): void {
	const len = node.attributes.length;
	for (let i = 0; i < len; i++) {
		fn(node.attributes.item(i) as Attr);
	}
}

/**
 * Parses a XML value and converts the value to a JS value if it detects it as a
 * boolean, null, or a number.
 * @param value - The value of the XML node
 * @param parseBoolean - Whether to parse the value as a boolean
 * @returns The parsed value
 */
export function parse(
	value: string | null,
	parseBoolean?: boolean
): string | number | boolean | null {
	if (value === null || value === 'null') {
		return null;
	}
	const num = Number(value);
	if (value === '' || typeof value !== 'string' || isNaN(num)) {
		value = value == undefined ? '' : value.toString().trim(); // eslint-disable-line eqeqeq
		if (parseBoolean && value === 'true') {
			return true;
		}
		if (parseBoolean && value === 'false') {
			return false;
		}
		return value;
	}
	return num;
}

/**
 * Gets and parses an attribute of an XML node. If attribute does not exist, it
 * returns an empty string.
 * @param node - An XML node
 * @param attr - The name of the attribute to get
 * @returns The value of the attribute or empty string if attribute does not exist
 * string if attribute does not exist
 */
export function getAttr(node: Element, attr: string): string | number | null {
	return node && (parse(node.getAttribute(attr), false) as string | number | null)
		|| null;
}

/**
 * Gets and parses an attribute of an XML node as a string. If attribute does
 * not exist, it returns an empty string.
 * @param node - An XML node
 * @param attr - The name of the attribute to get
 * @returns The value of the attribute or empty string if attribute does not exist
 */
export function getAttrString(node: Element, attr: string): string {
	return node.getAttribute(attr) || '';
}

/**
 * Determines if the specified XML node has a child data node and returns it as
 * a string.
 * @param node - An XML node
 * @returns The value of the XML node
 */
export function getValueString(node: Element): string {
	return node?.firstChild?.textContent || '';
}

/**
 * Determines if the specified XML node has a child data node and returns it.
 * @param node - An XML node
 * @returns The value of the XML node
 */
export function getValue(node: Element): string | number | boolean | null {
	return node?.firstChild ? parse(node.firstChild.textContent || '', true) : '';
}
