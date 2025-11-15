import { DOMParser } from '@xmldom/xmldom';
import fs from 'node:fs';
import path from 'node:path';
import * as xml from './xml.js';

/**
 * Creates a JavaScript type-friendly plist value.
 * @class
 * @classdesc An object to represent JavaScript type-friendly plist value.
 * @constructor
 * @param {String} type - The custom data type
 * @param {*} value - The value
 */
function PlistType(type, value) {
	this.className = 'PlistType';
	this.type = type;
	this.value = type === 'real' && Number.parseInt(value) === value ? value.toFixed(1) : value;
}

/**
 * JSON stringify formatter that properly translates PlistType objects.
 * @param {String} _key - The object key
 * @param {PlistType|*} value - The value being stringify
 * @returns {*}
 */
function plistTypeFormatter(_key, value) {
	if (value && typeof value === 'object' && value.className === 'PlistType') {
		return value.value;
	}
	return value;
}

/**
 * Recursively converts a JSON object to XML.
 * @param {Object} dom - The destination XML DOM
 * @param {Object} parent - The parent object XML DOM node
 * @param {*} it - The variable to add to the XML DOM
 * @param {Number} [indent=0] - The depth in which to indent
 */
function toXml(dom, parent, it, indent) {
	let i = indent || 0;
	let p;
	let q = parent;
	const type = Object.prototype.toString.call(it);

	while (q.parentNode) {
		i++;
		q = q.parentNode;
	}

	switch (type) {
		case '[object Object]':
			if (it.className === 'PlistType') {
				dom.create(it.type, it.value, parent);
			} else {
				p = dom.create('dict', null, parent);
				for (const name of Object.keys(it)) {
					dom.create('key', name, p);
					toXml(dom, p, it[name], indent);
				}
				p.appendChild(dom.createTextNode(`\r\n${'\t'.repeat(i)}`));
			}
			break;

		case '[object Array]':
			p = dom.create('array', null, parent);
			for (const val of it) {
				toXml(dom, p, val, indent);
			}
			p.appendChild(dom.createTextNode(`\r\n${'\t'.repeat(i)}`));
			break;

		case '[object Date]':
			// note: plists do not support milliseconds
			dom.create('date', it.toISOString().replace(/\.\d+Z$/, 'Z'), parent);
			break;

		case '[object Boolean]':
			p = dom.create(it ? 'true' : 'false', null, parent);
			break;

		case '[object Null]':
			break;

		case '[object String]':
			dom.create('string', it, parent);
			break;

		case '[object Number]':
			dom.create(~~it === it ? 'integer' : 'real', it, parent);
			break;
	}
}

/**
 * Recursively walks a XML node that represents a plist <dict> tag.
 * @param {Object} obj - The destination JSON object
 * @param {Object} node - The DOM node to walk
 */
function walkDict(obj, node) {
	let key;
	let next;

	while (node) {
		if (node.nodeType === xml.ELEMENT_NODE) {
			if (node.tagName !== 'key') {
				throw new Error('Error parsing plist: Expected <key> entry');
			}

			key = (node.firstChild && node.firstChild.data || '').trim();

			next = node.nextSibling;
			while (next && next.nodeType !== xml.ELEMENT_NODE) {
				next = next.nextSibling;
			}

			if (!next) {
				// all done
				return;
			}

			node = next;

			if (next.tagName === 'key') {
				obj[key] = null;
				continue;
			}

			if (next.tagName === 'dict') {
				walkDict(obj[key] = {}, next.firstChild);
			} else if (next.tagName === 'true') {
				obj[key] = true;
			} else if (next.tagName === 'false') {
				obj[key] = false;
			} else if (next.tagName === 'string') {
				obj[key] = '' + (next.firstChild && next.firstChild.data || '').trim(); // cast all values as strings
			} else if (next.tagName === 'integer') {
				obj[key] = Number.parseInt(next.firstChild && next.firstChild.data) || 0;
			} else if (next.tagName === 'real') {
				obj[key] = Number.parseFloat(next.firstChild && next.firstChild.data) || 0;
			} else if (next.tagName === 'date') {
				// note: plists do not support milliseconds
				const d = (next.firstChild && next.firstChild.data || '').trim();
				obj[key] = d ? new Date(d) : null; // note: toXml() can't convert a null date back to a <date> tag
			} else if (next.tagName === 'array') {
				walkArray(obj[key] = [], next.firstChild);
			} else if (next.tagName === 'data') {
				obj[key] = new PlistType('data', (next.firstChild && next.firstChild.data || '').replace(/\s*/g, ''));
				node = next;
			}
		}
		node = node.nextSibling;
	}
}

/**
 * Recursively walks a XML node that represents a plist <array> tag.
 * @param {Array} arr - The destination JavaScript array
 * @param {Object} node - The DOM node to walk
 */
function walkArray(arr, node) {
	while (node) {
		if (node.nodeType === xml.ELEMENT_NODE) {
			switch (node.tagName) {
				case 'string':
					arr.push('' + (node.firstChild && node.firstChild.data || '').trim());
					break;

				case 'integer':
					arr.push(Number.parseInt(node.firstChild && node.firstChild.data) || 0);
					break;

				case 'real':
					arr.push(Number.parseFloat(node.firstChild && node.firstChild.data) || 0.0);
					break;

				case 'true':
					arr.push(true);
					break;

				case 'false':
					arr.push(false);
					break;

				case 'array':
					const a = [];
					walkArray(a, node.firstChild);
					arr.push(a);
					break;

				case 'date':
					// note: plists do not support milliseconds
					const d = (node.firstChild && node.firstChild.data || '').trim();
					arr.push(d ? new Date(d) : null);
					break;

				case 'dict':
					const obj = {};
					walkDict(obj, node.firstChild);
					arr.push(obj);
					break;

				case 'data':
					arr.push(new PlistType('data', (node.firstChild && node.firstChild.data || '').replace(/\s*/g, '')));
			}
		}
		node = node.nextSibling;
	}
}

/**
 * Converts an XML DOM to a JSON object.
 * @param {Object} obj - The destination JSON object
 * @param {Object} doc - The DOM node to walk
 */
function toJS(obj, doc) {
	let node = doc.firstChild;

	// the first child should be a <dict> element
	while (node) {
		if (node.nodeType === xml.ELEMENT_NODE && node.tagName === 'dict') {
			node = node.firstChild;
			break;
		}
		node = node.nextSibling;
	}

	if (node) {
		walkDict(obj, node);
	}
}

/**
 * Creates an empty plist object or loads and parses a plist file.
 * @class
 * @classdesc An object that represents a plist as a JavaScript object.
 * @constructor
 * @param {String} [filename] - A plist file to load
 */
export class plist {
	constructor(filename) {
		this.filename = filename;

		if (filename) {
			this.load(filename);
		}
	}

	/**
	 * Loads and parses a plist file.
	 * @param {String} file - A plist file to load
	 * @returns {plist} The plist instance
	 * @throws {Error} If plist file does not exist
	 */
	load(file) {
		if (!fs.existsSync(file)) {
			throw new Error('plist file does not exist');
		}
		return this.parse(fs.readFileSync(file, 'utf8'));
	}

	/**
	 * Parses a plist from a string.
	 * @param {String} str - The plist string
	 * @returns {plist} The plist instance
	 * @throws {Error} If plist is malformed XML
	 */
	parse(str) {
		const dom = new DOMParser({
			errorHandler: (_level, err) => {
				throw err;
			}
		}).parseFromString(str, 'text/xml');

		toJS(this, dom.documentElement);

		return this;
	}

	/**
	 * Serializes a plist instance to an XML document.
	 * @param {Number} [indent=0] - The depth in which to indent
	 * @returns {Object} A XML document object
	 */
	toXml(indent) {
		const dom = new DOMParser().parseFromString('<plist version="1.0"/>');

		dom.create = (tag, nodeValue, parent) => {
			const node = dom.createElement(tag);
			let i = indent || 0;
			let p = parent;

			if (nodeValue) {
				node.appendChild(dom.createTextNode('' + nodeValue));
			}

			if (p) {
				while (p.parentNode) {
					i++;
					p = p.parentNode;
				}
				parent.appendChild(dom.createTextNode(`\r\n${'\t'.repeat(i)}`));
			}

			if (parent) {
				parent.appendChild(node);
			}

			return node;
		};

		toXml(dom, dom.documentElement, this, indent);

		dom.documentElement.appendChild(dom.createTextNode('\r\n'));

		return dom.documentElement;
	}

	/**
	 * Creates a custom plist data type.
	 * @param {String} type - The custom data type
	 * @param {*} value - The value
	 * @returns {PlistType} The plist data value
	 */
	type(type, value) {
		return new PlistType(type, value);
	}

	/**
	 * Serializes a plist instance to a string.
	 * @param {String} [fmt] - The format: undefined, 'xml', 'pretty-json', or 'json'
	 * @returns {String} The serialized plist
	 */
	toString(fmt) {
		if (fmt === 'xml') {
			return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
				+ this.toXml().toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		} else if (fmt === 'pretty-json') {
			return JSON.stringify(this, plistTypeFormatter, '\t');
		} else if (fmt === 'json') {
			return JSON.stringify(this, plistTypeFormatter);
		}
		return Object.prototype.toString.call(this);
	}

	/**
	 * Serializes a plist instance to XML, then writes it to the specified file.
	 * @param {String} file - The plist file to be written
	 * @returns {plist} The plist instance
	 */
	save(file) {
		if (file) {
			fs.mkdirsSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, this.toString('xml'));
		}
		return this;
	}
}
