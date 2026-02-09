import type { ZodSchema } from 'zod';
import { Plist } from '../util/plist.js';
import * as xml from '../util/xml.js';

/**
 * Convert camelCase to kebab-case for XML tag names
 */
export function toXmlTag(camelCase: string): string {
	return camelCase.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/**
 * Convert kebab-case to camelCase for JavaScript property names
 */
export function toCamelCase(xmlTag: string): string {
	return xmlTag.replace(/-([a-z])/g, (_m, p1) => p1.toUpperCase());
}

/**
 * Find an element by tag name and optional platform attribute
 */
export function findElement(
	doc: Document,
	tagName: string,
	platform?: string,
): Element | null {
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
		if (child.nodeType === 3) { // TEXT_NODE
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
	platform?: string,
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
 * Parse value from element
 * Keep values as strings to preserve XML format
 */
export function parseValue(elem: Element): any {
	const value = xml.getValueString(elem);
	return value;
}

/**
 * Collect all unique element tag names
 */
export function collectAllElements(doc: Document): string[] {
	const keys = new Set<string>();
	const root = doc.documentElement;
	let child = root.firstChild;

	while (child) {
		if (child.nodeType === xml.ELEMENT_NODE) {
			const elem = child as Element;
			keys.add(toCamelCase(elem.tagName));
		}
		child = child.nextSibling;
	}

	return Array.from(keys);
}

/**
 * Create a platform-specific proxy (e.g., for id.android, id.ios)
 */
export function createPlatformProxy(
	doc: Document,
	tagName: string,
	_instance: any,
): any {
	const handler = {
		get(_target: any, platform: string) {
			if (typeof platform === 'symbol') return undefined;

			const elem = findElement(doc, tagName, platform);
			if (elem) {
				return parseValue(elem);
			}
			return undefined;
		},

		set(_target: any, platform: string, value: any) {
			if (typeof platform === 'symbol') return false;

			let elem = findElement(doc, tagName, platform);
			if (elem) {
				updateElement(elem, value);
			} else {
				elem = createElement(doc, tagName, value, platform);
			}
			return true;
		},

		deleteProperty(_target: any, platform: string) {
			if (typeof platform === 'symbol') return false;

			const elem = findElement(doc, tagName, platform);
			if (elem) {
				removeElement(elem);
			}
			return true;
		},
	};

	return new Proxy({}, handler);
}

/**
 * Create an array proxy for modules
 */
export function createArrayProxy(
	doc: Document,
	containerTag: string,
	itemTag: string,
	_instance: any,
): any[] {
	const getModules = (): any[] => {
		const modules: any[] = [];

		// Find the container element (e.g., <modules>)
		const container = findElement(doc, containerTag);
		if (!container) return modules;

		// Find all item elements within the container
		let child = container.firstChild;
		while (child) {
			if (child.nodeType === xml.ELEMENT_NODE) {
				const elem = child as Element;
				if (elem.tagName === itemTag) {
					const module: any = {
						id: xml.getValueString(elem),
					};

					const platform = elem.getAttribute('platform');
					if (platform) {
						module.platform = platform;
					}

					const version = elem.getAttribute('version');
					if (version) {
						module.version = version;
					}

					const deployType = elem.getAttribute('deploy-type');
					if (deployType) {
						module.deployType = deployType;
					}

					modules.push(module);
				}
			}
			child = child.nextSibling;
		}

		return modules;
	};

	const syncToDOM = (modules: any[]) => {
		// Find or create the container
		let container = findElement(doc, containerTag);
		if (!container) {
			const root = doc.documentElement;
			const indent = detectIndentation(doc);
			root.appendChild(doc.createTextNode(`\n${indent}`));
			container = doc.createElement(containerTag);
			root.appendChild(container);
		}

		// Remove all existing module elements
		while (container.firstChild) {
			container.removeChild(container.firstChild);
		}

		// Add new modules
		const indent = detectIndentation(doc);
		for (const module of modules) {
			container.appendChild(doc.createTextNode(`\n${indent}${indent}`));
			const elem = doc.createElement(itemTag);
			elem.appendChild(doc.createTextNode(module.id));

			if (module.platform) {
				elem.setAttribute('platform', module.platform);
			}

			if (module.version) {
				elem.setAttribute('version', String(module.version));
			}

			if (module.deployType) {
				elem.setAttribute('deploy-type', module.deployType);
			}

			container.appendChild(elem);
		}

		if (modules.length > 0) {
			container.appendChild(doc.createTextNode(`\n${indent}`));
		}
	};

	const handler: ProxyHandler<any[]> = {
		get(target: any[], prop: string | symbol) {
			// Refresh from DOM on access
			const modules = getModules();

			if (prop === 'length') {
				return modules.length;
			}

			if (prop === 'push') {
				return (...items: any[]) => {
					const current = getModules();
					current.push(...items);
					syncToDOM(current);
					return current.length;
				};
			}

			if (prop === 'pop') {
				return () => {
					const current = getModules();
					const item = current.pop();
					syncToDOM(current);
					return item;
				};
			}

			if (prop === 'shift') {
				return () => {
					const current = getModules();
					const item = current.shift();
					syncToDOM(current);
					return item;
				};
			}

			if (prop === 'unshift') {
				return (...items: any[]) => {
					const current = getModules();
					current.unshift(...items);
					syncToDOM(current);
					return current.length;
				};
			}

			if (prop === 'splice') {
				return (start: number, deleteCount?: number, ...items: any[]) => {
					const current = getModules();
					const deleted = deleteCount !== undefined
						? current.splice(start, deleteCount, ...items)
						: current.splice(start);
					syncToDOM(current);
					return deleted;
				};
			}

			if (typeof prop === 'string') {
				const index = Number(prop);
				if (!isNaN(index) && index >= 0) {
					return modules[index];
				}
			}

			// Return array method from actual array
			return modules[prop as keyof typeof modules];
		},

		set(target: any[], prop: string | symbol, value: any) {
			if (typeof prop === 'string') {
				const index = Number(prop);
				if (!isNaN(index) && index >= 0) {
					const current = getModules();
					current[index] = value;
					syncToDOM(current);
					return true;
				}
			}
			return false;
		},
	};

	return new Proxy([], handler);
}

/**
 * Create a record proxy for properties
 */
export function createRecordProxy(
	doc: Document,
	containerTag: string,
	itemTag: string,
	_instance: any,
): any {
	const handler = {
		get(_target: any, propName: string | symbol) {
			if (typeof propName === 'symbol') return undefined;

			// Find property element with matching name attribute
			const elements = findElements(doc, itemTag);
			for (const elem of elements) {
				const name = elem.getAttribute('name');
				if (name === propName) {
					const type = elem.getAttribute('type') || 'string';
					const value = xml.getValueString(elem);

					return {
						type,
						value: type === 'bool'
							? value === 'true'
							: type === 'int'
							? Number.parseInt(value) || 0
							: type === 'double'
							? Number.parseFloat(value) || 0
							: value,
					};
				}
			}

			return undefined;
		},

		set(_target: any, propName: string | symbol, value: any) {
			if (typeof propName === 'symbol') return false;

			// Find or create property element
			const elements = findElements(doc, itemTag);
			let elem: Element | null = null;

			for (const e of elements) {
				const name = e.getAttribute('name');
				if (name === propName) {
					elem = e;
					break;
				}
			}

			if (!elem) {
				const root = doc.documentElement;
				const indent = detectIndentation(doc);
				root.appendChild(doc.createTextNode(`\n${indent}`));
				elem = doc.createElement(itemTag);
				elem.setAttribute('name', propName);
				root.appendChild(elem);
			}

			// Update attributes
			elem.setAttribute('type', value.type || 'string');

			// Update value
			while (elem.firstChild) {
				elem.removeChild(elem.firstChild);
			}
			elem.appendChild(doc.createTextNode(String(value.value)));

			return true;
		},

		deleteProperty(_target: any, propName: string | symbol) {
			if (typeof propName === 'symbol') return false;

			const elements = findElements(doc, itemTag);
			for (const elem of elements) {
				const name = elem.getAttribute('name');
				if (name === propName) {
					removeElement(elem);
					return true;
				}
			}

			return true;
		},

		ownKeys(_target: any) {
			const keys: string[] = [];
			const elements = findElements(doc, itemTag);
			for (const elem of elements) {
				const name = elem.getAttribute('name');
				if (name) {
					keys.push(name);
				}
			}
			return keys;
		},

		getOwnPropertyDescriptor(_target: any, prop: string | symbol) {
			if (typeof prop === 'symbol') return undefined;

			const elements = findElements(doc, itemTag);
			for (const elem of elements) {
				const name = elem.getAttribute('name');
				if (name === prop) {
					return {
						enumerable: true,
						configurable: true,
					};
				}
			}

			return undefined;
		},
	};

	return new Proxy({}, handler);
}

/**
 * Create a nested object proxy for iOS plist, entitlements, etc.
 */
export function createNestedObjectProxy(
	doc: Document,
	parentTag: string,
	childTag: string,
	_instance: any,
): any {
	const handler = {
		get(_target: any, prop: string | symbol) {
			if (typeof prop === 'symbol') return undefined;

			const parentElem = findElement(doc, parentTag);
			if (!parentElem) return undefined;

			// For plist/entitlements, parse the dict structure
			const childElem = parentElem.getElementsByTagName(childTag)[0];
			if (!childElem) return undefined;

			if (childTag === 'dict') {
				const pl = new Plist();
				pl.parse(`<plist version="1.0">${childElem.toString()}</plist>`);
				return pl[prop as string];
			}

			return undefined;
		},

		set(_target: any, prop: string | symbol, _value: any) {
			if (typeof prop === 'symbol') return false;

			// This would require reconstructing the plist dict structure
			// For now, just return true to indicate success
			return true;
		},
	};

	return new Proxy({}, handler);
}

/**
 * Create the root proxy for TiappXML instance
 */
export function createRootProxy(instance: any, schema?: ZodSchema): any {
	const handler: ProxyHandler<any> = {
		get(target: any, prop: string | symbol) {
			// Return methods directly
			if (prop === 'save' || prop === 'toString' || prop === 'parse' || prop === 'load' || prop === 'toJSON') {
				return target[prop].bind(target);
			}

			// Return internal properties
			if (prop === 'dom' || prop === 'proxy') {
				return target[prop];
			}

			if (typeof prop === 'symbol') return undefined;

			const xmlTag = toXmlTag(prop);
			const doc = target.dom;

			// Special handling for properties
			if (prop === 'properties') {
				return createRecordProxy(doc, 'properties', 'property', instance);
			}

			// Special handling for modules
			if (prop === 'modules') {
				return createArrayProxy(doc, 'modules', 'module', instance);
			}

			// Check if there are platform-specific variants
			const elements = findElements(doc, xmlTag);
			const hasPlatformVariants = elements.some((e) => e.getAttribute('platform'));

			if (hasPlatformVariants) {
				// Return the default value (non-platform-specific element)
				const defaultElem = findElement(doc, xmlTag);
				return defaultElem ? parseValue(defaultElem) : undefined;
			}

			// Find element
			const elem = findElement(doc, xmlTag);
			if (!elem) return undefined;

			// Special handling for complex nested structures
			if (prop === 'ios') {
				return createIOSProxy(doc, instance);
			}

			if (prop === 'android') {
				return createAndroidProxy(doc, instance);
			}

			if (prop === 'iphone') {
				return createIPhoneProxy(doc, instance);
			}

			if (prop === 'deploymentTargets') {
				return createDeploymentTargetsProxy(doc, instance);
			}

			// Default: return simple value
			return parseValue(elem);
		},

		set(target: any, prop: string | symbol, value: any) {
			if (typeof prop === 'symbol') return false;

			// Don't allow setting methods
			if (prop === 'save' || prop === 'toString' || prop === 'parse' || prop === 'load') {
				return false;
			}

			const xmlTag = toXmlTag(prop);
			const doc = target.dom;

			// Validate if schema provided
			if (schema && 'shape' in schema) {
				const propSchema = (schema as any).shape[prop];
				if (propSchema) {
					const result = propSchema.safeParse(value);
					if (!result.success) {
						throw new Error(`Validation failed for ${String(prop)}: ${result.error.message}`);
					}
				}
			}

			// Find or create element
			let elem = findElement(doc, xmlTag);
			if (elem) {
				updateElement(elem, value);
			} else {
				elem = createElement(doc, xmlTag, value);
			}

			return true;
		},

		deleteProperty(target: any, prop: string | symbol) {
			if (typeof prop === 'symbol') return false;

			const xmlTag = toXmlTag(prop);
			const doc = target.dom;
			const elem = findElement(doc, xmlTag);
			if (elem) {
				removeElement(elem);
			}

			return true;
		},

		ownKeys(target: any) {
			const doc = target.dom;
			return collectAllElements(doc);
		},

		getOwnPropertyDescriptor(target: any, prop: string | symbol) {
			// Methods are not enumerable
			if (
				prop === 'load' || prop === 'save' || prop === 'toString' || prop === 'parse'
				|| prop === 'toJSON' || prop === 'dom' || prop === 'proxy'
			) {
				return undefined;
			}

			if (typeof prop === 'symbol') return undefined;

			const xmlTag = toXmlTag(prop);
			const doc = target.dom;
			const elem = findElement(doc, xmlTag);

			if (elem) {
				return {
					enumerable: true,
					configurable: true,
				};
			}

			return undefined;
		},
	};

	return new Proxy(instance, handler);
}

/**
 * Create iOS configuration proxy
 */
function createIOSProxy(doc: Document, _instance: any): any {
	const handler = {
		get(_target: any, prop: string | symbol) {
			if (typeof prop === 'symbol') return undefined;

			const iosElem = findElement(doc, 'ios');
			if (!iosElem) return undefined;

			const xmlTag = toXmlTag(prop);

			// Special handling for plist
			if (prop === 'plist') {
				const plistElem = iosElem.getElementsByTagName('plist')[0];
				if (!plistElem) return undefined;

				const dictElem = plistElem.getElementsByTagName('dict')[0];
				if (!dictElem) return undefined;

				const pl = new Plist();
				pl.parse(`<plist version="1.0">${dictElem.toString()}</plist>`);

				// Filter out default CFBundle keys
				const filtered: Record<string, any> = {};
				for (const key of Object.keys(pl)) {
					if (
						!/^CFBundle(DisplayName|Executable|IconFile|Identifier|InfoDictionaryVersion|Name|PackageType|Signature)|LSRequiresIPhoneOS$/
							.test(key)
					) {
						filtered[key] = pl[key];
					}
				}

				return filtered;
			}

			// Special handling for entitlements
			if (prop === 'entitlements') {
				const entElem = iosElem.getElementsByTagName('entitlements')[0];
				if (!entElem) return undefined;

				const dictElem = entElem.getElementsByTagName('dict')[0];
				if (!dictElem) return undefined;

				const pl = new Plist();
				pl.parse(`<plist version="1.0">${dictElem.toString()}</plist>`);

				return pl;
			}

			// Special handling for capabilities
			if (prop === 'capabilities') {
				const capElem = iosElem.getElementsByTagName('capabilities')[0];
				if (!capElem) return undefined;

				const capabilities: Record<string, any> = {};
				let child = capElem.firstChild;

				while (child) {
					if (child.nodeType === xml.ELEMENT_NODE) {
						const elem = child as Element;
						if (elem.tagName === 'app-groups') {
							const groups: string[] = [];
							let groupChild = elem.firstChild;

							while (groupChild) {
								if (groupChild.nodeType === xml.ELEMENT_NODE) {
									const groupElem = groupChild as Element;
									if (groupElem.tagName === 'group') {
										groups.push(xml.getValueString(groupElem));
									}
								}
								groupChild = groupChild.nextSibling;
							}

							capabilities['app-groups'] = groups;
						}
					}
					child = child.nextSibling;
				}

				return capabilities;
			}

			// Find child element
			let child = iosElem.firstChild;
			while (child) {
				if (child.nodeType === xml.ELEMENT_NODE) {
					const elem = child as Element;
					if (elem.tagName === xmlTag) {
						return parseValue(elem);
					}
				}
				child = child.nextSibling;
			}

			return undefined;
		},

		set(_target: any, prop: string | symbol, _value: any) {
			if (typeof prop === 'symbol') return false;
			// Implement iOS property setting
			return true;
		},
	};

	return new Proxy({}, handler);
}

/**
 * Create Android configuration proxy
 */
function createAndroidProxy(doc: Document, _instance: any): any {
	const handler = {
		get(_target: any, prop: string | symbol) {
			if (typeof prop === 'symbol') return undefined;

			const androidElem = findElement(doc, 'android');
			if (!androidElem) return undefined;

			// Special handling for toolAPILevel (normalize to toolApiLevel)
			let normalizedProp = prop;
			if (prop === 'toolAPILevel') {
				normalizedProp = 'toolApiLevel';
			}

			const xmlTag = toXmlTag(normalizedProp);

			// Special handling for manifest
			if (normalizedProp === 'manifest') {
				const manifestElem = androidElem.getElementsByTagName('manifest')[0];
				if (!manifestElem) return undefined;

				return manifestElem.toString().replace(
					/ xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android"/g,
					'',
				);
			}

			// Special handling for abi
			if (normalizedProp === 'abi') {
				const abiElem = androidElem.getElementsByTagName('abi')[0];
				if (!abiElem) return undefined;

				return xml.getValueString(abiElem).split(',').map((s) => s.trim());
			}

			// Find child element
			let child = androidElem.firstChild;
			while (child) {
				if (child.nodeType === xml.ELEMENT_NODE) {
					const elem = child as Element;
					if (elem.tagName === xmlTag) {
						const value = xml.getValueString(elem);
						// Try to parse as number for toolAPILevel/toolApiLevel
						if (normalizedProp === 'toolApiLevel') {
							const num = Number.parseFloat(value);
							return isNaN(num) ? undefined : num;
						}
						return value;
					}
				}
				child = child.nextSibling;
			}

			return undefined;
		},

		set(_target: any, prop: string | symbol, _value: any) {
			if (typeof prop === 'symbol') return false;
			// Implement Android property setting
			return true;
		},
	};

	return new Proxy({}, handler);
}

/**
 * Create iPhone configuration proxy
 */
function createIPhoneProxy(doc: Document, _instance: any): any {
	const handler = {
		get(_target: any, prop: string | symbol) {
			if (typeof prop === 'symbol') return undefined;

			const iphoneElem = findElement(doc, 'iphone');
			if (!iphoneElem) return undefined;

			// Special handling for orientations
			if (prop === 'orientations') {
				const orientations: Record<string, string[]> = {};
				let child = iphoneElem.firstChild;

				while (child) {
					if (child.nodeType === xml.ELEMENT_NODE) {
						const elem = child as Element;
						if (elem.tagName === 'orientations') {
							const device = elem.getAttribute('device');
							if (device) {
								const orients: string[] = [];
								let orientChild = elem.firstChild;

								while (orientChild) {
									if (orientChild.nodeType === xml.ELEMENT_NODE) {
										const orientElem = orientChild as Element;
										if (orientElem.tagName === 'orientation') {
											orients.push(xml.getValueString(orientElem));
										}
									}
									orientChild = orientChild.nextSibling;
								}

								orientations[device] = orients;
							}
						}
					}
					child = child.nextSibling;
				}

				return orientations;
			}

			// Special handling for backgroundModes
			if (prop === 'backgroundModes') {
				const backgroundElem = iphoneElem.getElementsByTagName('background')[0];
				if (!backgroundElem) return undefined;

				const modes: string[] = [];
				let child = backgroundElem.firstChild;

				while (child) {
					if (child.nodeType === xml.ELEMENT_NODE) {
						const elem = child as Element;
						if (elem.tagName === 'mode') {
							modes.push(xml.getValueString(elem));
						}
					}
					child = child.nextSibling;
				}

				return modes;
			}

			// Special handling for requiredFeatures
			if (prop === 'requiredFeatures') {
				const requiresElem = iphoneElem.getElementsByTagName('requires')[0];
				if (!requiresElem) return undefined;

				const features: string[] = [];
				let child = requiresElem.firstChild;

				while (child) {
					if (child.nodeType === xml.ELEMENT_NODE) {
						const elem = child as Element;
						if (elem.tagName === 'feature') {
							features.push(xml.getValueString(elem));
						}
					}
					child = child.nextSibling;
				}

				return features;
			}

			return undefined;
		},

		set(_target: any, prop: string | symbol, _value: any) {
			if (typeof prop === 'symbol') return false;
			// Implement iPhone property setting
			return true;
		},
	};

	return new Proxy({}, handler);
}

/**
 * Create deployment targets proxy
 */
function createDeploymentTargetsProxy(doc: Document, _instance: any): any {
	const handler = {
		get(_target: any, prop: string | symbol) {
			if (typeof prop === 'symbol') return undefined;

			const targetsElem = findElement(doc, 'deployment-targets');
			if (!targetsElem) return undefined;

			let child = targetsElem.firstChild;
			while (child) {
				if (child.nodeType === xml.ELEMENT_NODE) {
					const elem = child as Element;
					if (elem.tagName === 'target') {
						const device = elem.getAttribute('device');
						if (device === prop) {
							return xml.getValueString(elem);
						}
					}
				}
				child = child.nextSibling;
			}

			return undefined;
		},

		set(_target: any, prop: string | symbol, _value: any) {
			if (typeof prop === 'symbol') return false;
			// Implement deployment target setting
			return true;
		},

		ownKeys(_target: any) {
			const keys: string[] = [];
			const targetsElem = findElement(doc, 'deployment-targets');
			if (!targetsElem) return keys;

			let child = targetsElem.firstChild;
			while (child) {
				if (child.nodeType === xml.ELEMENT_NODE) {
					const elem = child as Element;
					if (elem.tagName === 'target') {
						const device = elem.getAttribute('device');
						if (device) {
							keys.push(device);
						}
					}
				}
				child = child.nextSibling;
			}

			return keys;
		},

		getOwnPropertyDescriptor(_target: any, prop: string | symbol) {
			if (typeof prop === 'symbol') return undefined;

			const targetsElem = findElement(doc, 'deployment-targets');
			if (!targetsElem) return undefined;

			let child = targetsElem.firstChild;
			while (child) {
				if (child.nodeType === xml.ELEMENT_NODE) {
					const elem = child as Element;
					if (elem.tagName === 'target') {
						const device = elem.getAttribute('device');
						if (device === prop) {
							return {
								enumerable: true,
								configurable: true,
							};
						}
					}
				}
				child = child.nextSibling;
			}

			return undefined;
		},
	};

	return new Proxy({}, handler);
}
