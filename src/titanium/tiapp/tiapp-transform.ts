import { Plist } from '../../util/plist.js';
import * as xml from '../../util/xml.js';
import { TiappSchema, type Tiapp } from './tiapp-schema.js';

export type TiappData = Record<string, unknown>;

const ELEMENT_NODE = 1;

/**
 * Convert kebab-case to camelCase for JavaScript property names
 */
export function toCamelCase(xmlTag: string): string {
	return xmlTag.replace(/-([a-z])/g, (_m, p1) => p1.toUpperCase());
}

/**
 * Convert camelCase to kebab-case for XML tag names
 */
export function toXmlTag(camelCase: string): string {
	return camelCase.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/**
 * Find an element by tag name and optional platform attribute
 */
export function findElement(doc: Document, tagName: string, platform?: string): Element | null {
	const root = doc.documentElement;
	let child = root.firstChild;

	while (child) {
		if (child.nodeType === xml.ELEMENT_NODE) {
			const elem = child as Element;
			if (elem.tagName === tagName) {
				const platformAttr = elem.getAttribute('platform');
				if (platform && platformAttr === platform) {
					return elem;
				}
				if (!platform && !platformAttr) {
					return elem;
				}
			}
		}
		child = child.nextSibling;
	}

	return null;
}

/**
 * Find all elements by tag name
 */
export function findElements(doc: Document, tagName: string): Element[] {
	const elements: Element[] = [];
	const root = doc.documentElement;
	let child = root.firstChild;

	while (child) {
		if (child.nodeType === xml.ELEMENT_NODE) {
			const elem = child as Element;
			if (elem.tagName === tagName) {
				elements.push(elem);
			}
		}
		child = child.nextSibling;
	}

	return elements;
}

/**
 * Detect indentation pattern from existing content
 */
export function detectIndentation(doc: Document): string {
	const root = doc.documentElement;
	let child = root.firstChild;

	while (child) {
		if (child.nodeType === 3) {
			// TEXT_NODE
			const text = child.nodeValue || '';
			const match = text.match(/\n([\t ]+)/);
			if (match) {
				return match[1];
			}
		}
		child = child.nextSibling;
	}

	// Default to tab
	return '\t';
}

/**
 * Remove an element and its surrounding whitespace
 */
export function removeElement(elem: Element): void {
	const parent = elem.parentNode;
	if (!parent) {
		return;
	}

	// Remove preceding whitespace text node if it exists
	const prevSibling = elem.previousSibling;
	if (prevSibling && prevSibling.nodeType === 3) {
		const text = prevSibling.nodeValue || '';
		if (text.trim() === '') {
			parent.removeChild(prevSibling);
		}
	}

	// Remove the element
	parent.removeChild(elem);
}

/**
 * Create an element with proper whitespace
 */
export function createElement(
	doc: Document,
	tagName: string,
	value: any,
	platform?: string
): Element {
	const root = doc.documentElement;
	const indent = detectIndentation(doc);

	// Add whitespace before new element
	root.appendChild(doc.createTextNode(`\n${indent}`));

	// Create element
	const elem = doc.createElement(tagName);

	// Add platform attribute if specified
	if (platform) {
		elem.setAttribute('platform', platform);
	}

	// Set value
	if (value !== undefined && value !== null) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			elem.appendChild(doc.createTextNode(String(value)));
		}
	}

	root.appendChild(elem);

	return elem;
}

/**
 * Update an element's value
 */
export function updateElement(elem: Element, value: any): void {
	// Clear existing content
	while (elem.firstChild) {
		elem.removeChild(elem.firstChild);
	}

	// Set new value
	if (value !== undefined && value !== null) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			elem.appendChild(elem.ownerDocument.createTextNode(String(value)));
		}
	}
}

/**
 * Parse a simple text value, coercing booleans where appropriate.
 * Numbers are kept as strings to preserve XML format (e.g. version '1.0').
 */
function parseSimpleValue(elem: Element, parseBool = true): string | boolean {
	const raw = xml.getValueString(elem);
	if (parseBool && raw === 'true') {
		return true;
	}
	if (parseBool && raw === 'false') {
		return false;
	}
	return raw;
}

/**
 * Parse property value with type attribute
 */
function parsePropertyValue(elem: Element): { type: string; value: unknown } {
	const type = elem.getAttribute('type') || 'string';
	const raw = xml.getValueString(elem);
	let value: unknown = raw;
	if (type === 'bool') {
		value = raw === 'true';
	} else if (type === 'int') {
		value = Number.parseInt(raw) || 0;
	} else if (type === 'double') {
		value = Number.parseFloat(raw) || 0;
	}
	return { type, value };
}

/**
 * Read deployment-targets structure
 */
function readDeploymentTargets(doc: Document): Record<string, boolean | string> | undefined {
	const container = findElement(doc, 'deployment-targets');
	if (!container) {
		return undefined;
	}

	const result: Record<string, boolean | string> = {};
	let child = container.firstChild;
	while (child) {
		if (child.nodeType === ELEMENT_NODE) {
			const elem = child as Element;
			if (elem.tagName === 'target') {
				const device = elem.getAttribute('device');
				if (device) {
					const val = xml.getValueString(elem);
					result[device] = val === 'true' ? true : val === 'false' ? false : val;
				}
			}
		}
		child = child.nextSibling;
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Read properties structure (flat key -> value for JSON output)
 */
function readProperties(doc: Document): Record<string, unknown> | undefined {
	const elements = findElements(doc, 'property');
	if (elements.length === 0) {
		return undefined;
	}

	const result: Record<string, unknown> = {};
	for (const elem of elements) {
		const name = elem.getAttribute('name');
		if (name) {
			const pv = parsePropertyValue(elem);
			result[name] = pv.value;
		}
	}
	return result;
}

/**
 * Read modules array
 */
function readModules(
	doc: Document
):
	| Array<{ id: string; platform?: string; version?: string | number; deployType?: string }>
	| undefined {
	const container = findElement(doc, 'modules');
	if (!container) {
		return undefined;
	}

	const modules: Array<{
		id: string;
		platform?: string;
		version?: string | number;
		deployType?: string;
	}> = [];
	let child = container.firstChild;
	while (child) {
		if (child.nodeType === ELEMENT_NODE) {
			const elem = child as Element;
			if (elem.tagName === 'module') {
				const id = xml.getValueString(elem).trim() || elem.getAttribute('id') || '';
				if (id) {
					modules.push({
						id,
						platform: elem.getAttribute('platform') || undefined,
						version: elem.getAttribute('version') || undefined,
						deployType: elem.getAttribute('deploy-type') || undefined,
					});
				}
			}
		}
		child = child.nextSibling;
	}
	return modules;
}

/**
 * Read plugins array (plugin elements may be inside plugins container)
 */
function readPlugins(doc: Document): Array<{ id: string; version?: string | number }> | undefined {
	const elements = doc.getElementsByTagName ? doc.getElementsByTagName('plugin') : [];
	const list = Array.from(elements);
	if (list.length === 0) {
		return undefined;
	}

	return list.map((elem) => ({
		id: xml.getValueString(elem).trim(),
		version: elem.getAttribute('version') || undefined,
	}));
}

/**
 * Read iOS capabilities (app-groups etc.)
 */
function readIOSCapabilities(iosElem: Element): Record<string, unknown> | undefined {
	const capElem = iosElem.getElementsByTagName('capabilities')[0];
	if (!capElem) {
		return undefined;
	}

	const capabilities: Record<string, unknown> = {};
	let child = capElem.firstChild;
	while (child) {
		if (child.nodeType === ELEMENT_NODE) {
			const elem = child as Element;
			if (elem.tagName === 'app-groups' || elem.tagName === 'appGroups') {
				const groups: string[] = [];
				let groupChild = elem.firstChild;
				while (groupChild) {
					if (groupChild.nodeType === ELEMENT_NODE) {
						const g = groupChild as Element;
						if (g.tagName === 'group') {
							groups.push(xml.getValueString(g));
						}
					}
					groupChild = groupChild.nextSibling;
				}
				capabilities.appGroups = groups;
			}
		}
		child = child.nextSibling;
	}
	return Object.keys(capabilities).length > 0 ? capabilities : undefined;
}

/**
 * Read iOS config
 */
function readIOS(doc: Document): Record<string, unknown> | undefined {
	const iosElem = findElement(doc, 'ios');
	if (!iosElem) {
		return undefined;
	}

	const result: Record<string, unknown> = {};
	const simpleTags = [
		'enable-launch-screen-storyboard',
		'use-app-thinning',
		'enablecoverage',
		'enablemdfind',
		'default-background-color',
		'min-ios-ver',
		'team-id',
		'log-server-port',
		'use-jscore-framework',
		'run-on-main-thread',
		'use-autolayout',
		'use-new-build-system',
		'use-app-thinning',
		'exclude-dir-from-asset-catalog',
	];
	for (const tag of simpleTags) {
		const child = iosElem.getElementsByTagName(tag)[0];
		if (child) {
			const key = toCamelCase(tag);
			let val: unknown = parseSimpleValue(child);
			if (tag === 'log-server-port' && typeof val === 'string') {
				const n = Number.parseInt(val, 10);
				val = Number.isNaN(n) ? val : n;
			}
			result[key] = val;
		}
	}

	const cap = readIOSCapabilities(iosElem);
	if (cap) {
		result.capabilities = cap;
	}

	const entElem = iosElem.getElementsByTagName('entitlements')[0];
	if (entElem) {
		const dictElem = entElem.getElementsByTagName('dict')[0];
		if (dictElem) {
			const pl = new Plist();
			pl.parse(`<plist version="1.0">${dictElem.toString()}</plist>`);
			result.entitlements = { ...pl };
		}
	}

	const plistElem = iosElem.getElementsByTagName('plist')[0];
	if (plistElem) {
		result.plist = plistElem.toString();
	}

	const extElem = iosElem.getElementsByTagName('extensions')[0];
	if (extElem) {
		const extensions: Array<{
			projectPath: string;
			target?: string;
			provisioningProfiles?: Array<Record<string, unknown>>;
		}> = [];
		const extList = extElem.getElementsByTagName('extension');
		for (let i = 0; i < extList.length; i++) {
			const ext = extList[i];
			const projectPath =
				ext.getAttribute('projectPath') ||
				ext.getAttribute('project-path') ||
				xml.getValueString(ext) ||
				'';
			const extObj: {
				projectPath: string;
				target?: string;
				provisioningProfiles?: Array<Record<string, unknown>>;
			} = { projectPath };
			const targets = ext.getElementsByTagName('target');
			if (targets.length > 0) {
				const t = targets[0];
				extObj.target = t.getAttribute('name') || xml.getValueString(t) || '';
				const ppElem = t.getElementsByTagName('provisioning-profiles')[0];
				if (ppElem) {
					const profiles: Array<Record<string, unknown>> = [];
					const device = ppElem.getElementsByTagName('device')[0];
					const distAppstore = ppElem.getElementsByTagName('dist-appstore')[0];
					const distAdhoc = ppElem.getElementsByTagName('dist-adhoc')[0];
					if (device || distAppstore || distAdhoc) {
						const prof: Record<string, unknown> = {};
						if (device) {
							prof.device = xml.getValueString(device);
						}
						if (distAppstore) {
							prof.distAppstore = xml.getValueString(distAppstore);
						}
						if (distAdhoc) {
							prof.distAdhoc = true;
						}
						profiles.push(prof);
					}
					extObj.provisioningProfiles = profiles;
				}
			}
			extensions.push(extObj);
		}
		if (extensions.length > 0) {
			result.extensions = extensions;
		}
	}

	return result;
}

/**
 * Read Android config
 */
function readAndroid(doc: Document): Record<string, unknown> | undefined {
	// findElement may miss 'android' in namespaced docs; try getElementsByTagName
	let androidElem = findElement(doc, 'android');
	if (!androidElem && doc.getElementsByTagName) {
		const list = doc.getElementsByTagName('android');
		androidElem = list.length ? list[0] : null;
	}
	if (!androidElem) {
		return undefined;
	}

	const result: Record<string, unknown> = {};
	const manifestElem = androidElem.getElementsByTagName('manifest')[0];
	if (manifestElem) {
		result.manifest = manifestElem
			.toString()
			.replace(/ xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android"/g, '');
	}

	// tool-api-level: search within android
	let toolApiVal: number | undefined;
	const toolApiList = androidElem.getElementsByTagName('tool-api-level');
	if (toolApiList.length > 0) {
		toolApiVal = Number.parseFloat(xml.getValueString(toolApiList[0]));
	}
	if (toolApiVal === undefined || Number.isNaN(toolApiVal)) {
		// Fallback: walk direct children (getElementsByTagName can fail in namespaced docs)
		xml.forEachElement(androidElem, (el) => {
			const name = (el as Element & { localName?: string }).localName || el.tagName || '';
			if (name.toLowerCase().replace(/_/g, '-') === 'tool-api-level') {
				const v = Number.parseFloat(xml.getValueString(el));
				if (!Number.isNaN(v)) {
					toolApiVal = v;
				}
			}
		});
	}
	if (toolApiVal !== undefined && !Number.isNaN(toolApiVal)) {
		result.toolAPILevel = toolApiVal;
	}

	const abiElem = androidElem.getElementsByTagName('abi')[0];
	if (abiElem) {
		const abiVal = xml.getValueString(abiElem);
		result.abi = abiVal.includes(',') ? abiVal.split(',').map((s) => s.trim()) : abiVal;
	}

	const activitiesElem = androidElem.getElementsByTagName('activities')[0];
	if (activitiesElem) {
		const activities: Array<Record<string, unknown>> = [];
		const acts = activitiesElem.getElementsByTagName('activity');
		for (let i = 0; i < acts.length; i++) {
			const a = acts[i];
			const url = a.getAttribute('url') || xml.getValueString(a) || '';
			activities.push({
				url,
				...Object.fromEntries(
					Array.from(a.attributes)
						.filter((attr) => attr.name !== 'url')
						.map((attr) => [toCamelCase(attr.name), attr.value])
				),
			});
		}
		result.activities = activities;
	}

	const servicesElem = androidElem.getElementsByTagName('services')[0];
	if (servicesElem) {
		const services: Array<Record<string, unknown>> = [];
		const svcs = servicesElem.getElementsByTagName('service');
		for (let i = 0; i < svcs.length; i++) {
			const s = svcs[i];
			const url = s.getAttribute('url') || xml.getValueString(s) || '';
			services.push({
				url,
				...Object.fromEntries(
					Array.from(s.attributes)
						.filter((attr) => attr.name !== 'url')
						.map((attr) => [toCamelCase(attr.name), attr.value])
				),
			});
		}
		result.services = services;
	}

	return result;
}

/**
 * Read webpack config
 */
function readWebpack(doc: Document): Record<string, unknown> | undefined {
	const webpackElem = findElement(doc, 'webpack');
	if (!webpackElem) {
		return undefined;
	}

	const result: Record<string, unknown> = {};
	const typeElem = webpackElem.getElementsByTagName('type')[0];
	if (typeElem) {
		result.type = xml.getValueString(typeElem);
	}

	const depsElem = webpackElem.getElementsByTagName('transpile-dependencies')[0];
	if (depsElem) {
		const deps: string[] = [];
		const depList = depsElem.getElementsByTagName('dep');
		for (let i = 0; i < depList.length; i++) {
			deps.push(xml.getValueString(depList[i]));
		}
		result.transpileDependencies = deps;
	}

	return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Simple scalar tags at root level (with optional platform attribute)
 */
const SIMPLE_TAGS = [
	'id',
	'name',
	'version',
	'publisher',
	'url',
	'description',
	'copyright',
	'icon',
	'fullscreen',
	'navbar-hidden',
	'analytics',
	'guid',
	'persistent-wifi',
	'prerendered-icon',
	'statusbar-style',
	'statusbar-hidden',
	'sdk-version',
];

/**
 * Convert tiapp XML document to JSON object
 */
export function tiappXmlToJson(doc: Document): TiappData {
	const result: TiappData = {};
	const root = doc.documentElement;

	// Track which tags have platform variants
	const platformTags = new Set<string>();
	let child = root.firstChild;
	while (child) {
		if (child.nodeType === ELEMENT_NODE) {
			const elem = child as Element;
			if (elem.getAttribute('platform')) {
				platformTags.add(elem.tagName);
			}
		}
		child = child.nextSibling;
	}

	// Process each direct child
	child = root.firstChild;
	while (child) {
		if (child.nodeType === ELEMENT_NODE) {
			const elem = child as Element;
			const tagName = elem.tagName;
			const camelKey = toCamelCase(tagName);

			if (SIMPLE_TAGS.includes(tagName)) {
				if (platformTags.has(tagName) && tagName === 'id') {
					const platform = elem.getAttribute('platform');
					const val = xml.getValueString(elem);
					if (platform) {
						const platformKey = 'idPlatform' + platform.charAt(0).toUpperCase() + platform.slice(1);
						result[platformKey] = val;
					} else {
						result.id = val;
					}
				} else if (!platformTags.has(tagName) && !result[camelKey]) {
					const val = parseSimpleValue(elem);
					result[camelKey] = val;
				}
			} else if (tagName === 'deployment-targets') {
				result.deploymentTargets = readDeploymentTargets(doc);
			} else if (tagName === 'property') {
				// Handled in readProperties
				if (!result.properties) {
					result.properties = readProperties(doc);
				}
			} else if (tagName === 'modules') {
				result.modules = readModules(doc);
			} else if (tagName === 'plugins') {
				if (!result.plugins) {
					result.plugins = readPlugins(doc);
				}
			} else if (tagName === 'ios') {
				result.ios = readIOS(doc);
			} else if (
				tagName === 'android' ||
				(elem as Element & { localName?: string }).localName === 'android'
			) {
				result.android = readAndroid(doc);
			} else if (tagName === 'webpack') {
				result.webpack = readWebpack(doc);
			}
		}
		child = child.nextSibling;
	}

	// Ensure plugins are read (container may have different tagName in namespaced docs)
	if (!result.plugins) {
		const plugins = readPlugins(doc);
		if (plugins && plugins.length > 0) {
			result.plugins = plugins;
		}
	}

	return result;
}

/**
 * Deep equality check
 */
function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}
	if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
		return false;
	}
	if (Array.isArray(a) !== Array.isArray(b)) {
		return false;
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) {
			return false;
		}
		return a.every((v, i) => deepEqual(v, b[i]));
	}
	const keysA = Object.keys(a as object);
	const keysB = Object.keys(b as object);
	if (keysA.length !== keysB.length) {
		return false;
	}
	return keysA.every(
		(k) =>
			keysB.includes(k) &&
			deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
	);
}

/**
 * Write a simple scalar value to XML
 */
function writeSimpleValue(doc: Document, key: string, value: unknown, platform?: string): void {
	const xmlTag = toXmlTag(key);
	const strVal = value === true ? 'true' : value === false ? 'false' : String(value);
	const elem = findElement(doc, xmlTag, platform);
	if (elem) {
		updateElement(elem, strVal);
	} else {
		createElement(doc, xmlTag, strVal, platform);
	}
}

/**
 * Remove a simple element
 */
function removeSimpleElement(doc: Document, key: string, platform?: string): void {
	const xmlTag = toXmlTag(key);
	const elem = findElement(doc, xmlTag, platform);
	if (elem) {
		removeElement(elem);
	}
}

/**
 * Normalize property value to { type, value } format
 */
function normalizePropertyValue(pv: unknown): { type: string; value: unknown } {
	if (pv !== null && typeof pv === 'object' && 'value' in pv) {
		return {
			type: (pv as { type?: string }).type || 'string',
			value: (pv as { value: unknown }).value,
		};
	}
	// Infer type from flat value
	const type = typeof pv === 'boolean' ? 'bool' : typeof pv === 'number' ? 'double' : 'string';
	return { type, value: pv };
}

/**
 * Write properties to XML
 */
function writeProperties(doc: Document, properties: Record<string, unknown>): void {
	const root = doc.documentElement;
	const indent = detectIndentation(doc);
	const existing = findElements(doc, 'property');
	const existingNames = new Set(existing.map((e) => e.getAttribute('name')).filter(Boolean));

	for (const [name, pv] of Object.entries(properties)) {
		const { type, value } = normalizePropertyValue(pv);
		let val: string;
		if (type === 'bool') {
			val = value ? 'true' : 'false';
		} else if (type === 'int' || type === 'double') {
			val = String(value);
		} else {
			val = String(value ?? '');
		}

		if (existingNames.has(name)) {
			const elem = existing.find((e) => e.getAttribute('name') === name);
			if (elem) {
				elem.setAttribute('type', type);
				updateElement(elem, val);
			}
		} else {
			root.appendChild(doc.createTextNode(`\n${indent}`));
			const elem = doc.createElement('property');
			elem.setAttribute('name', name);
			elem.setAttribute('type', type);
			elem.appendChild(doc.createTextNode(val));
			root.appendChild(elem);
		}
	}

	// Remove properties that are no longer in the object
	for (const elem of existing) {
		const name = elem.getAttribute('name');
		if (name && !(name in properties)) {
			removeElement(elem);
		}
	}
}

/**
 * Write deployment targets to XML
 */
function writeDeploymentTargets(doc: Document, targets: Record<string, boolean | string>): void {
	const indent = detectIndentation(doc);
	const root = doc.documentElement;
	let container = findElement(doc, 'deployment-targets');
	if (!container) {
		root.appendChild(doc.createTextNode(`\n${indent}`));
		container = doc.createElement('deployment-targets');
		root.appendChild(container);
	}

	// Clear and rebuild
	while (container!.firstChild) {
		container!.removeChild(container!.firstChild);
	}
	const innerIndent = indent + indent;
	for (const [device, value] of Object.entries(targets)) {
		container!.appendChild(doc.createTextNode(`\n${innerIndent}`));
		const target = doc.createElement('target');
		target.setAttribute('device', device);
		target.appendChild(doc.createTextNode(String(value)));
		container!.appendChild(target);
	}
	container!.appendChild(doc.createTextNode(`\n${indent}`));
}

/**
 * Write modules to XML
 */
function writeModules(
	doc: Document,
	modules: Array<{ id: string; platform?: string; version?: string | number; deployType?: string }>
): void {
	const indent = detectIndentation(doc);
	const root = doc.documentElement;
	let container = findElement(doc, 'modules');
	if (!container) {
		root.appendChild(doc.createTextNode(`\n${indent}`));
		container = doc.createElement('modules');
		root.appendChild(container);
	}

	while (container!.firstChild) {
		container!.removeChild(container!.firstChild);
	}
	const innerIndent = indent + indent;
	for (const mod of modules) {
		container!.appendChild(doc.createTextNode(`\n${innerIndent}`));
		const elem = doc.createElement('module');
		if (mod.platform) {
			elem.setAttribute('platform', mod.platform);
		}
		if (mod.version !== undefined) {
			elem.setAttribute('version', String(mod.version));
		}
		if (mod.deployType) {
			elem.setAttribute('deploy-type', mod.deployType);
		}
		elem.appendChild(doc.createTextNode(mod.id));
		container!.appendChild(elem);
	}
	container!.appendChild(doc.createTextNode(`\n${indent}`));
}

/**
 * Write plugins to XML
 */
function writePlugins(
	doc: Document,
	plugins: Array<{ id: string; version?: string | number }>
): void {
	const existing = findElements(doc, 'plugin');
	const root = doc.documentElement;
	const indent = detectIndentation(doc);

	for (const p of existing) {
		removeElement(p);
	}

	for (const p of plugins) {
		root.appendChild(doc.createTextNode(`\n${indent}`));
		const elem = doc.createElement('plugin');
		if (p.version !== undefined) {
			elem.setAttribute('version', String(p.version));
		}
		elem.appendChild(doc.createTextNode(p.id));
		root.appendChild(elem);
	}
}

/**
 * Build full id value (string or platform object) from flat tiapp data
 */
function buildFullId(data: TiappData): string | Record<string, string | undefined> | undefined {
	const idVal = data.id;
	const platformKeys = ['Ios', 'Android', 'Iphone', 'Ipad'];
	const platformObj: Record<string, string | undefined> = {};

	if (typeof idVal === 'string') {
		platformObj.default = idVal;
	} else if (idVal && typeof idVal === 'object' && !Array.isArray(idVal)) {
		Object.assign(platformObj, idVal as Record<string, string | undefined>);
	}

	for (const k of platformKeys) {
		const key = 'idPlatform' + k;
		const platform = k.toLowerCase();
		if (data[key] !== undefined && data[key] !== null) {
			platformObj[platform] = String(data[key]);
		}
	}

	if (Object.keys(platformObj).length === 0) {
		return undefined;
	}
	if (Object.keys(platformObj).length === 1 && platformObj.default !== undefined) {
		return platformObj.default;
	}
	return platformObj;
}

/**
 * Write platform-specific id
 */
function writeId(doc: Document, id: string | Record<string, string | undefined>): void {
	if (typeof id === 'string') {
		// Remove any platform-specific id elements, keep only default
		const elems = findElements(doc, 'id');
		for (const e of elems) {
			if (e.getAttribute('platform')) {
				removeElement(e);
			}
		}
		const defaultElem = findElement(doc, 'id');
		if (defaultElem) {
			updateElement(defaultElem, id);
		} else {
			createElement(doc, 'id', id);
		}
	} else {
		const obj = id as Record<string, string | undefined>;
		for (const [platform, value] of Object.entries(obj)) {
			if (value === undefined) {
				continue;
			}
			const key = platform === 'default' ? undefined : platform;
			const elem = findElement(doc, 'id', key);
			if (elem) {
				updateElement(elem, value);
			} else {
				createElement(doc, 'id', value, key);
			}
		}
		// Remove ids not in obj
		const elems = findElements(doc, 'id');
		for (const e of elems) {
			const platform = e.getAttribute('platform') || 'default';
			if (!(platform in obj)) {
				removeElement(e);
			}
		}
	}
}

/**
 * Apply diff from before to after, updating the XML document
 */
function applyDiff(doc: Document, before: TiappData, after: TiappData, key: string): void {
	const beforeVal = before[key];
	const afterVal = after[key];

	if (deepEqual(beforeVal, afterVal)) {
		return;
	}

	if (afterVal === undefined) {
		// Remove
		if (key === 'id') {
			for (const e of findElements(doc, 'id')) {
				removeElement(e);
			}
		} else if (key === 'properties') {
			const elems = findElements(doc, 'property');
			for (const e of elems) removeElement(e);
		} else if (key === 'deploymentTargets') {
			const container = findElement(doc, 'deployment-targets');
			if (container) {
				removeElement(container);
			}
		} else if (key === 'modules') {
			const container = findElement(doc, 'modules');
			if (container) {
				while (container.firstChild) {
					container.removeChild(container.firstChild);
				}
			}
		} else if (key === 'plugins') {
			for (const e of findElements(doc, 'plugin')) {
				removeElement(e);
			}
		} else if (key === 'ios') {
			const ios = findElement(doc, 'ios');
			if (ios) {
				removeElement(ios);
			}
		} else if (key === 'android') {
			const android = findElement(doc, 'android');
			if (android) {
				removeElement(android);
			}
		} else if (key === 'webpack') {
			const webpack = findElement(doc, 'webpack');
			if (webpack) {
				removeElement(webpack);
			}
		} else {
			removeSimpleElement(doc, key);
		}
		return;
	}

	// Add or update
	if (key === 'id' || key.startsWith('idPlatform')) {
		const fullId = buildFullId(after);
		if (fullId !== undefined) {
			writeId(doc, fullId);
		}
	} else if (key === 'properties' && typeof afterVal === 'object' && afterVal !== null) {
		writeProperties(doc, afterVal as Record<string, unknown>);
	} else if (key === 'deploymentTargets' && typeof afterVal === 'object' && afterVal !== null) {
		writeDeploymentTargets(doc, afterVal as Record<string, boolean | string>);
	} else if (key === 'modules' && Array.isArray(afterVal)) {
		writeModules(
			doc,
			afterVal as Array<{
				id: string;
				platform?: string;
				version?: string | number;
				deployType?: string;
			}>
		);
	} else if (key === 'plugins' && Array.isArray(afterVal)) {
		writePlugins(doc, afterVal as Array<{ id: string; version?: string | number }>);
	} else if (key === 'ios' || key === 'android' || key === 'webpack') {
		// For nested structures, we'd need full write support. For now, skip deep diff.
		// If it changed, we could replace the whole element - but that's complex.
		// For MVP, only support top-level and known structures.
		// TODO: implement ios/android/webpack write
	} else if (
		typeof afterVal === 'string' ||
		typeof afterVal === 'number' ||
		typeof afterVal === 'boolean'
	) {
		writeSimpleValue(doc, key, afterVal);
	}
}

/**
 * Validate tiapp data against schema
 */
export function validateTiappData(data: TiappData): Tiapp {
	const result = TiappSchema.safeParse(data);
	if (!result.success) {
		const msg = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
		throw new Error(`Invalid tiapp data: ${msg}`);
	}
	return result.data;
}

/**
 * Apply JSON changes to XML document. Computes diff between before and after,
 * updates the document accordingly, and validates the result.
 */
export function applyTiappJsonToXml(before: TiappData, after: TiappData, doc: Document): Document {
	validateTiappData(after);

	const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
	for (const key of allKeys) {
		applyDiff(doc, before, after, key);
	}

	return doc;
}
