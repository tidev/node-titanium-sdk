import { DOMParser, type Options } from '@xmldom/xmldom';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isFile } from '../util/is-file.js';
import * as xml from '../util/xml.js';
import {
	createRootProxy,
	toCamelCase,
} from './tiapp-proxy.js';
import { TiappSchema, type Tiapp } from './tiapp-schema.js';

declare module '@xmldom/xmldom' {
	interface Options {
		xmlns?: { [key: string]: string };
	}
}

const defaultDOMParserArgs: Options = {
	errorHandler: () => {},
};

/**
 * Methods available on the TiappXML proxy
 */
export interface TiappXMLMethods {
	load(file: string): TiappXMLProxy;
	parse(content: string): TiappXMLProxy;
	save(file: string): TiappXMLProxy;
	toJSON(): Record<string, any>;
	toString(): string;
}

/**
 * Combined type for the proxy returned by TiappXML constructor
 */
export type TiappXMLProxy = Tiapp & TiappXMLMethods;

/**
 * Internal implementation class - users should use the returned proxy
 */
class TiappXMLImpl {
	dom!: Document;
	proxy!: TiappXMLProxy;

	constructor(file?: string) {
		// Initialize with empty document
		this.dom = new DOMParser(defaultDOMParserArgs).parseFromString(
			'<?xml version="1.0" encoding="UTF-8"?>\n<ti:app xmlns:ti="http://ti.tidev.io"></ti:app>',
			'text/xml',
		);

		// Create root proxy
		this.proxy = createRootProxy(this, TiappSchema) as TiappXMLProxy;

		// Load file if provided
		if (file) {
			this.load(file);
		}

		// TypeScript doesn't support typing constructors that return different types
		// so we use a Proxy wrapper (see below) to properly type the return value
		// @ts-expect-error - Returning proxy instead of `this`
		return this.proxy;
	}

	load(file: string): TiappXMLProxy {
		if (!isFile(file)) {
			throw new Error('tiapp.xml file does not exist');
		}
		const content = readFileSync(file, 'utf8');
		return this.parse(content);
	}

	parse(content: string): TiappXMLProxy {
		this.dom = new DOMParser(defaultDOMParserArgs).parseFromString(content, 'text/xml');
		return this.proxy;
	}

	toString(): string {
		const xmlStr = this.dom.toString();
		if (xmlStr.startsWith('<?xml')) {
			return xmlStr;
		}
		return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlStr}`;
	}

	save(file: string): TiappXMLProxy {
		if (file) {
			mkdirSync(path.dirname(file), { recursive: true });
			writeFileSync(file, this.toString());
		}
		return this.proxy;
	}

	toJSON(): Record<string, any> {
		const result: Record<string, any> = {};
		const root = this.dom.documentElement;
		let child = root.firstChild;

		// Track which properties have platform variants
		const platformProps = new Set<string>();

		// First pass: identify platform-specific properties
		while (child) {
			if (child.nodeType === xml.ELEMENT_NODE) {
				const elem = child as Element;
				const platform = elem.getAttribute('platform');
				if (platform) {
					platformProps.add(elem.tagName);
				}
			}
			child = child.nextSibling;
		}

		// Second pass: build result object
		child = root.firstChild;
		while (child) {
			if (child.nodeType === xml.ELEMENT_NODE) {
				const elem = child as Element;
				const camelKey = toCamelCase(elem.tagName);
				const platform = elem.getAttribute('platform');

				if (platformProps.has(elem.tagName)) {
					// Handle platform-specific properties
					if (!result[camelKey]) {
						result[camelKey] = {};
					}

					if (platform) {
						// Platform-specific value
						if (typeof result[camelKey] === 'string') {
							// Convert existing string to object
							const defaultValue = result[camelKey];
							result[camelKey] = { default: defaultValue };
						}
						result[camelKey][platform] = this.proxy[camelKey]?.[platform] || xml.getValueString(elem);
					} else {
						// Default value for platform property
						if (typeof result[camelKey] === 'object' && !Array.isArray(result[camelKey])) {
							result[camelKey].default = this.proxy[camelKey] || xml.getValueString(elem);
						} else {
							result[camelKey] = this.proxy[camelKey] || xml.getValueString(elem);
						}
					}
				} else if (!result[camelKey]) {
					// Regular property (no platform variants)
					try {
						result[camelKey] = this.proxy[camelKey];
					} catch {
						// Fallback to string value if proxy access fails
						result[camelKey] = xml.getValueString(elem);
					}
				}
			}
			child = child.nextSibling;
		}

		return result;
	}
}

/**
 * Factory function to create a TiappXML proxy
 *
 * @param file - Optional path to tiapp.xml file to load
 * @returns A proxy object with Tiapp schema properties and methods
 *
 * @example
 * ```ts
 * const tiapp = new TiappXML();
 * tiapp.sdkVersion = '1.2.3';
 * console.log(tiapp.toJSON());
 * ```
 */
export const TiappXML = new Proxy(TiappXMLImpl, {
	construct(target, args): TiappXMLProxy {
		return new target(...args);
	},
}) as unknown as new (file?: string) => TiappXMLProxy;

export default TiappXML;
