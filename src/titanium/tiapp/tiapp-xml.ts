import { isFile } from '../../util/is-file.js';
import { mergeDeep } from '../../util/merge-deep.js';
import { tiappXmlToJson, applyTiappJsonToXml, validateTiappData } from './tiapp-transform.js';
import { DOMParser, type Document } from '@xmldom/xmldom';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Factory function to create a TiappXML proxy
 *
 * @param file - Optional path to tiapp.xml file to load
 * @returns A proxy object with Tiapp schema properties and methods
 *
 * @example
 * ```ts
 * const tiapp = new TiappXML();
 * const data = tiapp.data();
 * data.sdkVersion = '1.2.3';
 * tiapp.apply(data).save('/tmp/test-tiapp.xml');
 * ```
 */
export class TiappXML {
	dom!: Document;
	file?: string;

	constructor(file?: string) {
		// Load file if provided
		if (file) {
			this.load(file);
		} else {
			// Initialize with empty document
			this.dom = new DOMParser().parseFromString(
				'<?xml version="1.0" encoding="UTF-8"?>\n<ti:app xmlns:ti="http://ti.tidev.io"></ti:app>',
				'text/xml'
			);
		}
	}

	apply(data: Record<string, any>) {
		this.dom = applyTiappJsonToXml(this.data(), data, this.dom);
		return this;
	}

	data(): Record<string, any> {
		return tiappXmlToJson(this.dom);
	}

	load(file: string) {
		if (!isFile(file)) {
			throw new Error('tiapp.xml file does not exist');
		}
		this.file ??= file;
		const content = readFileSync(file, 'utf8');
		return this.parse(content);
	}

	merge(data: Record<string, any>) {
		this.apply(mergeDeep(this.data(), data));
		return this;
	}

	parse(content: string) {
		this.dom = new DOMParser().parseFromString(content, 'text/xml');
		validateTiappData(tiappXmlToJson(this.dom));
		return this;
	}

	save(file: string) {
		file = this.file ?? file;
		if (file) {
			mkdirSync(dirname(file), { recursive: true });
			writeFileSync(file, this.toString());
		}
		return this;
	}

	toString(): string {
		const xmlStr = this.dom.toString();
		if (xmlStr.startsWith('<?xml')) {
			return xmlStr;
		}
		return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlStr}`;
	}
}
