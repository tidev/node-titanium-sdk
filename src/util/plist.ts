import { DOMParser } from '@xmldom/xmldom';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isFile } from './is-file.js';
import * as xml from './xml.js';

interface PlistDocument extends XMLDocument {
	create(tag: string, nodeValue: string | null, parent: Node): Element;
}

class PlistType {
	className: string;
	type: string;
	value: any;

	/**
	 * Creates a JavaScript type-friendly plist value.
	 * @param type - The custom data type
	 * @param value - The value
	 */
	constructor(type: string, value: any) {
		this.className = 'PlistType';
		this.type = type;
		this.value = type === 'real' && Number.parseInt(value) === value
			? value.toFixed(1)
			: value;
	}
}

/**
 * JSON stringify formatter that properly translates PlistType objects.
 * @param _key - The object key (unused)
 * @param value - The value being stringify
 * @returns The value being stringified
 */
function plistTypeFormatter(_key: string, value: any) {
	if (value && typeof value === 'object' && value.className === 'PlistType') {
		return value.value;
	}
	return value;
}

/**
 * Recursively converts a JSON object to XML.
 * @param dom - The destination XML DOM
 * @param parent - The parent object XML DOM node
 * @param it - The variable to add to the XML DOM
 * @param indent - The depth in which to indent
 */
function toXml(dom: PlistDocument, parent: Node, it: any, indent: number = 0) {
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
			dom.create(Number.parseInt(it) === it ? 'integer' : 'real', it, parent);
			break;
	}
}

/**
 * Recursively walks a XML node that represents a plist <dict> tag.
 * @param obj - The destination JSON object
 * @param node - The DOM node to walk
 */
function walkDict(obj: any, node: Node) {
	let key;
	let next;

	while (node) {
		if (node.nodeType === xml.ELEMENT_NODE) {
			if ((node as Element).tagName !== 'key') {
				throw new Error('Error parsing plist: Expected <key> entry');
			}

			key = (node.firstChild && (node.firstChild as Text).data || '').trim();

			next = (node as Node).nextSibling;
			while (next && (next as Node).nodeType !== xml.ELEMENT_NODE) {
				next = next.nextSibling;
			}

			if (!next) {
				// all done
				return;
			}

			node = next as Node;

			if ((next as Element).tagName === 'key') {
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
				obj[key] = new PlistType(
					'data',
					(next.firstChild && next.firstChild.data || '').replace(/\s*/g, '')
				);
				node = next;
			}
		}
		node = node.nextSibling as Node;
	}
}

/**
 * Recursively walks a XML node that represents a plist <array> tag.
 * @param arr - The destination JavaScript array
 * @param node - The DOM node to walk
 */
function walkArray(arr: any[], node: Node) {
	while (node) {
		if (node.nodeType === xml.ELEMENT_NODE) {
			switch ((node as Element).tagName) {
				case 'string':
					arr.push('' + (node.firstChild?.textContent || '').trim());
					break;

				case 'integer':
					arr.push(Number.parseInt(node.firstChild?.textContent || '') || 0);
					break;

				case 'real':
					arr.push(Number.parseFloat(node.firstChild?.textContent || '') || 0.0);
					break;

				case 'true':
					arr.push(true);
					break;

				case 'false':
					arr.push(false);
					break;

				case 'array':
					const a = [];
					walkArray(a, node.firstChild as Node);
					arr.push(a);
					break;

				case 'date':
					// note: plists do not support milliseconds
					const d = (node.firstChild?.textContent || '').trim();
					arr.push(d ? new Date(d) : null);
					break;

				case 'dict':
					const obj = {};
					walkDict(obj, node.firstChild as Node);
					arr.push(obj);
					break;

				case 'data':
					arr.push(
						new PlistType(
							'data',
							(node.firstChild?.textContent || '').replace(/\s*/g, '')
						)
					);
			}
		}
		node = node.nextSibling as Node;
	}
}

/**
 * Converts an XML DOM to a JSON object.
 * @param obj - The destination JSON object
 * @param doc - The DOM node to walk
 */
function toJS(obj: any, doc: Element) {
	let node = doc.firstChild;

	// the first child should be a <dict> element
	while (node) {
		if (node.nodeType === xml.ELEMENT_NODE && (node as Element).tagName === 'dict') {
			node = node.firstChild;
			break;
		}
		node = node.nextSibling;
	}

	if (node) {
		walkDict(obj, node);
	}
}

export class Plist {
	filename?: string;

	/**
	 * Creates an empty plist object or loads and parses a plist file.
	 * @param filename - A plist file to load
	 */
	constructor(filename?: string) {
		this.filename = filename;

		if (filename) {
			this.load(filename);
		}
	}

	/**
	 * Loads and parses a plist file.
	 * @param file - A plist file to load
	 * @returns The plist instance
	 * @throws If plist file does not exist
	 */
	async load(file: string): Promise<this> {
		if (!isFile(file)) {
			throw new Error('plist file does not exist');
		}
		return this.parse(await readFile(file, 'utf8'));
	}

	/**
	 * Parses a plist from a string.
	 * @param str - The plist string
	 * @returns The plist instance
	 * @throws If plist is malformed XML
	 */
	parse(str: string): this {
		const dom = new DOMParser({
			errorHandler: (_level, err) => {
				throw err;
			},
		}).parseFromString(str, 'text/xml');

		toJS(this, dom.documentElement);

		return this;
	}

	/**
	 * Serializes a plist instance to an XML document.
	 * @param indent - The depth in which to indent
	 * @returns A XML document object
	 */
	toXml(indent = 0): Element {
		const dom = new DOMParser().parseFromString(
			'<plist version="1.0"/>'
		) as PlistDocument;

		dom.create = (tag: string, nodeValue: string | null, parent: Node) => {
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
	 * @param type - The custom data type
	 * @param value - The value
	 * @returns The plist data value
	 */
	type(type: string, value: any): PlistType {
		return new PlistType(type, value);
	}

	/**
	 * Serializes a plist instance to a string.
	 * @param fmt - The format: undefined, 'xml', 'pretty-json', or 'json'
	 * @returns The serialized plist
	 */
	toString(fmt?: string): string {
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
	 * @param file - The plist file to be written
	 * @returns The plist instance
	 */
	async save(file: string): Promise<this> {
		if (file) {
			await mkdir(path.dirname(file), { recursive: true });
			await writeFile(file, this.toString('xml'));
		}
		return this;
	}
}
