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
