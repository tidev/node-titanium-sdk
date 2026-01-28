import { DOMParser, type Options } from '@xmldom/xmldom';
import { mkdir, readFileSync, writeFile } from 'node:fs';
import path from 'node:path';
import { capitalize } from '../util/capitalize.js';
import { isFile } from '../util/is-file.js';
import { Plist } from '../util/plist.js';
import * as version from '../util/version.js';
import * as xml from '../util/xml.js';

interface TiappDocument extends XMLDocument {
	create(
		tag: string,
		attrs: Record<string, any> | null,
		parent: Node,
		callback?: (node: Node) => void
	): Element;
}

interface TiappIOS {
	capabilities?: Record<string, any>;
	entitlements?: Record<string, any>;
	plist?: Record<string, any>;
	extensions?: Record<string, any>;
	iphone?: Record<string, any>;
	excludeDirFromAssetCatalog?: boolean;
	enableLaunchScreenStoryboard?: boolean;
	enableCoverage?: boolean;
	enableMDFind?: boolean;
	minIOSVer?: number;
	defaultBackgroundColor?: string;
}

interface TiappIPhone {
	orientations: Record<string, string[]>;
	backgroundModes?: string[];
	requiredFeatures?: string[];
	types?: Record<string, any>;
}

interface TiappAndroid {
	manifest?: string;
	toolAPILevel?: number;
	abi?: string[];
	activities?: Record<string, any>;
	services?: Record<string, any>;
}

interface TiappModules {
	platform?: string;
	version?: number;
	deployType?: string;
	id?: string;
}

declare module '@xmldom/xmldom' {
	interface Options {
		xmlns?: { [key: string]: string };
	}
}

const defaultDOMParserArgs: Options = {
	errorHandler: () => {},
};

function toXml(dom: TiappDocument, parent: Node, name: string, value: any) {
	// properties is a super special case
	if (name === 'properties') {
		for (const v of Object.keys(value)) {
			dom.create('property', {
				name: v,
				type: value[v].type || 'string',
				nodeValue: value[v].value,
			}, parent);
		}
		return;
	}

	const node = dom.create(name, null, parent);

	switch (name) {
		case 'deployment-targets':
			for (const v of Object.keys(value)) {
				dom.create('target', {
					device: v,
					nodeValue: value[v],
				}, node);
			}
			break;

		case 'ios':
			if (Object.prototype.hasOwnProperty.call(value, 'exclude-dir-from-asset-catalog')) {
				dom.create('exclude-dir-from-asset-catalog', {
					nodeValue: !!value['exclude-dir-from-asset-catalog'],
				}, node);
			}

			if (
				Object.prototype.hasOwnProperty.call(value, 'enable-launch-screen-storyboard')
			) {
				dom.create('enable-launch-screen-storyboard', {
					nodeValue: !!value['enable-launch-screen-storyboard'],
				}, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'enablecoverage')) {
				dom.create('enablecoverage', { nodeValue: !!value['enablecoverage'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'enablemdfind')) {
				dom.create('enablemdfind', { nodeValue: !!value['enablemdfind'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'min-ios-ver')) {
				dom.create(
					'min-ios-ver',
					{ nodeValue: version.format(value['min-ios-ver'], 2) },
					node
				);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'default-background-color')) {
				dom.create('default-background-color', {
					nodeValue: value['default-background-color'],
				}, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'team-id')) {
				dom.create('team-id', { nodeValue: value['team-id'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'use-jscore-framework')) {
				dom.create(
					'use-jscore-framework',
					{ nodeValue: !!value['use-jscore-framework'] },
					node
				);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'run-on-main-thread')) {
				dom.create(
					'run-on-main-thread',
					{ nodeValue: !!value['run-on-main-thread'] },
					node
				);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'use-autolayout')) {
				dom.create('use-autolayout', { nodeValue: !!value['use-autolayout'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'use-new-build-system')) {
				dom.create(
					'use-new-build-system',
					{ nodeValue: !!value['use-new-build-system'] },
					node
				);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'use-app-thinning')) {
				dom.create('use-app-thinning', { nodeValue: !!value['use-app-thinning'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'log-server-port')) {
				dom.create('log-server-port', { nodeValue: value['log-server-port'] }, node);
			}

			if (value.capabilities) {
				const capNode = dom.create('capabilities', null, node);
				for (const cap of Object.keys(value.capabilities)) {
					if (cap === 'app-groups') {
						const appGroupNode = dom.create(cap, null, capNode);
						for (const group of value.capabilities[cap]) {
							dom.create('group', { nodeValue: group }, appGroupNode);
						}
						appGroupNode.appendChild(dom.createTextNode('\r\n\t\t\t'));
						capNode.appendChild(dom.createTextNode('\r\n\t\t'));
					}
				}
			}

			if (value.entitlements) {
				const enNode = dom.create('entitlements', null, node);
				const pl = new Plist();
				Object.assign(pl, value.entitlements);
				const doc = pl.toXml(3);
				enNode.appendChild(dom.createTextNode('\r\n\t\t\t'));
				xml.forEachElement(doc, (elem) => {
					enNode.appendChild(elem);
				});
				enNode.appendChild(dom.createTextNode('\r\n\t\t'));
			}

			if (value.plist) {
				const plNode = dom.create('plist', null, node);
				const pl = new Plist();
				Object.assign(pl, value.plist);
				const doc = pl.toXml(3);
				plNode.appendChild(dom.createTextNode('\r\n\t\t\t'));
				xml.forEachElement(doc, (elem) => {
					plNode.appendChild(elem);
				});
				plNode.appendChild(dom.createTextNode('\r\n\t\t'));
			}

			if (Array.isArray(value.extensions)) {
				const extsNode = dom.create('extentions', null, node);
				for (const ext of value.extensions) {
					const extNode = dom.create(
						'extention',
						{ projectPath: ext.projectPath },
						extsNode
					);
					if (Array.isArray(ext.targets)) {
						for (const target of ext.targets) {
							const targetNode = dom.create('target', { name: target.name }, extNode);
							if (
								target.ppUUIDs && typeof target.ppUUIDs === 'object'
								&& Object.keys(target.ppUUIDs).length
							) {
								const ppUUIDsNode = dom.create('provisioning-profiles', null, targetNode);
								for (const type of Object.keys(target.ppUUIDs)) {
									dom.create(type, { nodeValue: target.ppUUIDs[type] }, ppUUIDsNode);
								}
								ppUUIDsNode.appendChild(dom.createTextNode('\r\n\t\t\t\t\t'));
							}
							targetNode.appendChild(dom.createTextNode('\r\n\t\t\t\t'));
						}
					}
					extNode.appendChild(dom.createTextNode('\r\n\t\t\t'));
				}
				extsNode.appendChild(dom.createTextNode('\r\n\t\t'));
			}
			break;

		case 'iphone':
			if (value.orientations) {
				for (const o of Object.keys(value.orientations)) {
					dom.create('orientations', { device: o }, node, (orientations) => {
						for (const p of value.orientations[o]) {
							dom.create('orientation', { nodeValue: p }, orientations);
						}
					});
				}
			}

			if (Array.isArray(value.backgroundModes)) {
				dom.create('background', null, node, (background) => {
					for (const mode of value.backgroundModes) {
						dom.create('mode', { nodeValue: mode }, background);
					}
				});
			}

			if (Array.isArray(value.requiredFeatures)) {
				dom.create('requires', null, node, (requires) => {
					for (const feature of value.requiredFeatures) {
						dom.create('feature', { nodeValue: feature }, requires);
					}
				});
			}

			if (Array.isArray(value.types)) {
				dom.create('types', null, node, (types) => {
					for (const typeObj of value.types) {
						dom.create('type', null, types, (typeNode) => {
							dom.create('name', { nodeValue: typeObj.name }, typeNode);
							dom.create('icon', { nodeValue: typeObj.icon }, typeNode);
							dom.create('uti', { nodeValue: typeObj.uti.join(',') }, typeNode);
							dom.create('owner', { nodeValue: !!typeObj.owner }, typeNode);
						});
					}
				});
			}
			break;

		case 'android':
			node.setAttribute('xmlns:android', 'http://schemas.android.com/apk/res/android');

			if (value.manifest) {
				node.appendChild(dom.createTextNode(`\r\n${'\t'.repeat(3)}`));
				const opts = defaultDOMParserArgs;
				opts.xmlns = { android: 'http://schemas.android.com/apk/res/android' };
				node.appendChild(new DOMParser(opts).parseFromString(value.manifest));
			}

			if (Object.prototype.hasOwnProperty.call(value, 'tool-api-level')) {
				dom.create('tool-api-level', { nodeValue: value['tool-api-level'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'abi')) {
				dom.create('abi', {
					nodeValue: Array.isArray(value.abi) ? value.abi.join(',') : value.abi,
				}, node);
			}

			if (value.activities) {
				dom.create('activities', null, node, (node) => {
					for (const url of Object.keys(value.activities)) {
						const attrs = {};
						for (const attr of Object.keys(value.activities[url])) {
							if (attr !== 'classname') {
								attrs[attr] = value.activities[url][attr];
							}
						}
						dom.create('activity', attrs, node);
					}
				});
			}

			if (value.services) {
				dom.create('services', null, node, (node) => {
					for (const url of Object.keys(value.services)) {
						const attrs = {};
						for (const attr of Object.keys(value.services[url])) {
							if (attr !== 'classname') {
								attrs[attr] = value.services[url][attr];
							}
						}
						dom.create('service', attrs, node);
					}
				});
			}
			break;

		case 'modules':
			if (Array.isArray(value)) {
				for (const mod of value) {
					dom.create('module', {
						platform: mod.platform,
						version: mod.version ? version.format(mod.version, 2) : null,
						'deploy-type': mod.deployType || null,
						nodeValue: mod.id,
					}, node);
				}
			}
			break;

		default:
			node.appendChild(dom.createTextNode(value));
			return;
	}

	node.appendChild(dom.createTextNode(`\r\n${'\t'.repeat(2)}`));
}

function toJS(obj: any, doc: Element, targetPlatform?: string) {
	let node = doc.firstChild;
	while (node) {
		if (node.nodeType === xml.ELEMENT_NODE) {
			const elem = node as Element;
			switch (elem.tagName) {
				case 'property':
					const name = xml.getAttr(elem, 'name');
					const type = xml.getAttr(elem, 'type') || 'string';
					const value = xml.getValue(elem);
					if (name) {
						if (!obj.properties) {
							obj.properties = {};
						}
						obj.properties[name] = {
							type: type,
							value: type === 'bool'
								? (typeof value === 'boolean' ? value : value === 'true')
								: type === 'int'
								? (typeof value === 'string' ? Number.parseInt(value) : value || 0)
								: type === 'double'
								? (typeof value === 'string' ? Number.parseFloat(value) : value || 0)
								: '' + value,
						};
					}
					break;

				case 'deployment-targets':
					const targets = obj['deployment-targets'] = {};
					xml.forEachElement(node as Element, (elem) => {
						const dev = xml.getAttr(elem, 'device');
						if (dev) {
							targets[dev] = xml.getValueString(elem);
						}
					});
					break;

				case 'ios':
					const ios: TiappIOS = {};
					obj.ios = ios;
					xml.forEachElement(node as Element, (elem) => {
						switch (elem.tagName) {
							case 'exclude-dir-from-asset-catalog':
							case 'enable-launch-screen-storyboard':
							case 'enablecoverage':
							case 'enablemdfind':
							case 'default-background-color':
							case 'team-id':
							case 'use-jscore-framework':
							case 'run-on-main-thread':
							case 'use-autolayout':
							case 'use-app-thinning':
							case 'use-new-build-system':
							case 'log-server-port':
								ios[elem.tagName] = xml.getValueString(elem);
								break;

							case 'min-ios-ver':
								if (elem.firstChild) {
									ios['min-ios-ver'] = Number.parseFloat(xml.getValueString(elem)) || 0;
								}
								break;

							case 'capabilities':
								const capabilities: Record<string, any> = {};
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'app-groups') {
										const appGroups: string[] = [];
										capabilities[elem.tagName] = appGroups;
										xml.forEachElement(elem, (elem) => {
											if (elem.tagName === 'group') {
												const group = xml.getValueString(elem);
												if (group) {
													appGroups.push(group);
												}
											}
										});
									}
								});
								ios.capabilities = capabilities;
								break;

							case 'entitlements':
								const entitlements: Record<string, any> = {};
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'dict') {
										const pl = new Plist();
										pl.parse(`<plist version="1.0">${elem.toString()}</plist>`);
										for (const prop of Object.keys(pl)) {
											entitlements[prop] = pl[prop];
										}
									}
								});
								ios.entitlements = entitlements;
								break;

							case 'plist':
								const plist: Record<string, any> = {};
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'dict') {
										const pl = new Plist().parse(
											`<plist version="1.0">${elem.toString()}</plist>`
										);
										for (const prop of Object.keys(pl)) {
											if (
												!/^CFBundle(DisplayName|Executable|IconFile|Identifier|InfoDictionaryVersion|Name|PackageType|Signature)|LSRequiresIPhoneOS$/
													.test(prop)
											) {
												plist[prop] = pl[prop];
											}
										}
									}
								});
								ios.plist = plist;
								break;

							case 'extensions':
								const extensions: Record<string, any>[] = [];
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName !== 'extension') {
										return;
									}

									const ext: Record<string, any> = {
										projectPath: elem.getAttribute('projectPath') || null,
										targets: [],
									};
									extensions.push(ext);

									xml.forEachElement(elem, (elem) => {
										if (elem.tagName !== 'target') {
											return;
										}

										const target: Record<string, any> = {
											name: elem.getAttribute('name'),
											ppUUIDs: {},
										};
										ext.targets.push(target);

										xml.forEachElement(elem, (elem) => {
											if (elem.tagName === 'provisioning-profiles') {
												xml.forEachElement(elem, (elem) => {
													target.ppUUIDs[elem.tagName] = xml.getValue(elem) as string;
												});
											}
										});
									});
								});
								ios.extensions = extensions;
								break;
						}
					});
					break;

				case 'iphone':
					const iphone: TiappIPhone = {
						orientations: {},
					};
					obj.iphone = iphone;
					xml.forEachElement(node as Element, (elem) => {
						switch (elem.tagName) {
							case 'orientations':
								const dev = xml.getAttr(elem, 'device');
								if (dev) {
									if (!iphone.orientations[dev]) {
										iphone.orientations[dev] = [];
									}
									xml.forEachElement(elem, (elem) => {
										iphone.orientations[dev].push(xml.getValueString(elem));
									});
								}
								break;

							case 'background':
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'mode') {
										if (!iphone.backgroundModes) {
											iphone.backgroundModes = [];
										}
										iphone.backgroundModes.push(xml.getValueString(elem));
									}
								});
								break;

							case 'requires':
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'feature') {
										if (!iphone.requiredFeatures) {
											iphone.requiredFeatures = [];
										}
										iphone.requiredFeatures.push(xml.getValueString(elem));
									}
								});
								break;

							case 'types':
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'type') {
										if (!iphone.types) {
											iphone.types = [];
										}
										const type = {
											name: '',
											icon: '',
											uti: [],
											owner: false,
										};
										xml.forEachElement(elem, (elem) => {
											const v = xml.getValueString(elem);
											type[elem.tagName] = elem.tagName === 'uti'
												? v.split(',').map(s => s.trim())
												: v;
										});
										iphone.types.push(type);
									}
								});
								break;
						}
					});
					break;

				case 'android':
					const android: TiappAndroid = {};
					obj.android = android;
					const formatUrl = (url) => {
						return capitalize(
							url.replace(/^app:\/\//, '').replace(/\.js$/, '').replace(/\//g, '_')
						).replace(/[/ .$&@]/g, '_');
					};

					xml.forEachElement(node as Element, (elem) => {
						switch (elem.tagName) {
							case 'manifest':
								// the <manifest> tag is an XML document and we're just gonna
								// defer the parsing to whoever wants its data
								// Strip the 'android' XML namespace on the uses-sdk tag! It's already defined at <android> tag level!
								android.manifest = elem.toString().replace(
									/ xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android"/g,
									''
								);
								break;

							case 'abi':
								android.abi = xml.getValueString(elem).split(',').map(s => s.trim());
								break;

							case 'tool-api-level':
								android.toolAPILevel = Number.parseFloat(xml.getValueString(elem)) || 0;
								break;

							case 'activities':
							case 'services':
								const type = elem.tagName;
								const dest: Record<string, any> = {};
								android[type] = dest;

								xml.forEachElement(elem, (elem) => {
									if (
										(type === 'activities' && elem.tagName === 'activity')
										|| (type === 'services' && elem.tagName === 'service')
									) {
										const url = xml.getAttr(elem, 'url') || xml.getValueString(elem)
											|| '';
										if (url) {
											const a: Record<string, any> = {};
											dest[url] = a;
											xml.forEachAttr(elem, (attr) => {
												a[attr.name] = xml.parse(attr.value);
											});
											a['classname'] = formatUrl(url)
												+ (type === 'activities' ? 'Activity' : 'Service');
											if (type === 'services') {
												a['type'] = xml.getAttr(elem, 'type') || 'standard';
											}
											a['url'] = url;
											xml.forEachElement(elem, (elem) => {
												if (elem.tagName === 'intent-filter') {
													let intentFilter: Record<string, any> | null = null;
													xml.forEachElement(elem, (elem) => {
														if (
															elem.tagName === 'action' || elem.tagName === 'category'
															|| elem.tagName === 'data'
														) {
															if (!intentFilter) {
																intentFilter = {};
															}
															if (!intentFilter[elem.tagName]) {
																intentFilter[elem.tagName] = [];
															}
															if (elem.tagName === 'data') {
																const a = {};
																xml.forEachAttr(elem, (attr) => {
																	a[attr.name.replace(/^android:/, '')] = xml.parse(
																		attr.value
																	);
																});
																intentFilter[elem.tagName].push(a);
															} else {
																intentFilter[elem.tagName].push(
																	xml.getAttr(elem, 'android:name')
																);
															}
														}
													});
													if (intentFilter) {
														if (!a['intent-filter']) {
															a['intent-filter'] = [];
														}
														a['intent-filter'].push(intentFilter);
													}
												} else if (elem.tagName === 'meta-data') {
													const obj: Record<string, any> = {};
													xml.forEachAttr(elem, (attr) => {
														obj[attr.name.replace(/^android:/, '')] = xml.parse(
															attr.value
														);
													});
													if (obj.name) {
														if (!a['meta-data']) {
															a['meta-data'] = {};
														}
														a['meta-data'][obj.name] = obj;
													}
												}
											});
										}
									}
								});
								break;
						}
					});
					break;

				case 'modules':
					const modules: TiappModules[] = [];
					obj.modules = modules;
					xml.forEachElement(node as Element, (elem) => {
						const opts: TiappModules = {
							id: xml.getValueString(elem),
							platform: xml.getAttrString(elem, 'platform'),
						};
						const version = elem.getAttribute('version');
						const deployType = xml.getAttrString(elem, 'deploy-type');
						if (version) {
							opts.version = Number.parseFloat(version) || 0;
						}
						if (deployType) {
							opts.deployType = deployType;
						}
						modules.push(opts);
					});
					break;

				case 'version':
					obj.version = xml.getValueString(node as Element).replace(/\n/g, '').trim();
					break;

				case 'id':
					if (
						(targetPlatform
							&& xml.getAttrString(node as Element, 'platform') === targetPlatform)
						|| obj[(node as Element).tagName] === undefined
					) {
						obj[(node as Element).tagName] = xml.getValueString(node as Element);
						if (typeof obj[(node as Element).tagName] === 'string') {
							obj[(node as Element).tagName] = obj[(node as Element).tagName].replace(
								/\n/g,
								''
							);
						}
					}
					break;

				case 'name':
				case 'guid':
				case 'icon':
					// need to strip out line returns which shouldn't be there in the first place
					obj[(node as Element).tagName] = xml.getValueString(node as Element);
					if (typeof obj[(node as Element).tagName] === 'string') {
						obj[(node as Element).tagName] = obj[(node as Element).tagName].replace(
							/\n/g,
							''
						);
					}
					break;

				default:
					obj[(node as Element).tagName] = xml.getValueString(node as Element);
			}
		}
		node = node.nextSibling;
	}
}

export class TiappXML {
	constructor() {
	}

	load(file: string): this {
		if (!isFile(file)) {
			throw new Error('tiapp.xml file does not exist');
		}
		const dom = new DOMParser(defaultDOMParserArgs);
		const doc = dom.parseFromString(
			readFileSync(file, 'utf8'),
			'text/xml'
		) as TiappDocument;
		toJS(this, doc.documentElement);
		return this;
	}

	parse(str: string): this {
		toJS(
			this,
			(new DOMParser(defaultDOMParserArgs).parseFromString(str, 'text/xml'))
				.documentElement,
		);
		return this;
	}

	toString(fmt?: string): string {
		if (fmt === 'xml') {
			const dom = new DOMParser(defaultDOMParserArgs).parseFromString(
				'<ti:app xmlns:ti="http://ti.tidev.io"/>',
				'text/xml'
			) as TiappDocument;

			dom.create = (
				tag: string,
				attrs: Record<string, any>,
				parent: Node,
				callback?: (node: Node) => void
			): Element => {
				const node = dom.createElement(tag);
				let i = 0;
				let p = parent;

				if (attrs) {
					for (const attr of Object.keys(attrs)) {
						if (attr === 'nodeValue') {
							node.appendChild(dom.createTextNode('' + attrs[attr]));
						} else if (attrs[attr] !== undefined) {
							node.setAttribute(attr, '' + attrs[attr]);
						}
					}
				}

				if (p) {
					while (p.parentNode) {
						i++;
						p = p.parentNode;
					}
					parent.appendChild(dom.createTextNode(`\r\n${'\t'.repeat(i + 1)}`));
				}

				if (parent) {
					parent.appendChild(node);
				}

				if (callback) {
					callback(node);
					node.appendChild(dom.createTextNode(`\r\n${'\t'.repeat(i + 1)}`));
				}
				return node;
			};

			for (const key of Object.keys(this)) {
				toXml(dom, dom.documentElement, key, this[key]);
			}

			dom.documentElement.appendChild(dom.createTextNode('\r\n'));

			const xml = dom.documentElement.toString();
			return `<?xml version="1.0" encoding="UTF-8"?>\n${
				xml.replace(
					/uses-sdk xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android"/,
					'uses-sdk'
				)
			}`;
		} else if (fmt === 'pretty-json') {
			return JSON.stringify(this, null, '\t');
		} else if (fmt === 'json') {
			return JSON.stringify(this);
		}
		return Object.prototype.toString.call(this);
	}

	async save(file: string): Promise<this> {
		if (file) {
			await mkdir(path.dirname(file), { recursive: true });
			await writeFile(file, this.toString('xml'));
		}
		return this;
	}
}

export default TiappXML;
