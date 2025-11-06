import appc from 'node-appc';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'node:fs';
import path from 'node:path';

const { plist, version, xml } = appc;

const defaultDOMParserArgs = { errorHandler: () => {} };

function toXml(dom, parent, name, value) {
	// properties is a super special case
	if (name === 'properties') {
		for (const v of Object.keys(value)) {
			dom.create('property', {
				name: v,
				type: value[v].type || 'string',
				nodeValue: value[v].value
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
					nodeValue: value[v]
				}, node);
			}
			break;

		case 'code-processor':
			for (const key of Object.keys(value)) {
				if (key === 'plugins') {
					if (Array.isArray(value[key]) && value[key].length) {
						dom.create('plugins', null, node, (plugins) => {
							for (const p of value[key]) {
								dom.create('plugin', { nodeValue: p }, plugins);
							}
						});
					}
				} else if (key === 'options') {
					if (Object.prototype.toString.call(value[key]) === '[object Object]') {
						dom.create('options', null, node, (options) => {
							for (const opt of Object.keys(value[key])) {
								dom.create(opt, { nodeValue: value[key][opt] }, options);
							}
						});
					}
				} else {
					dom.create(key, { nodeValue: value[key] }, node);
				}
			}
			break;

		case 'ios':
			if (Object.prototype.hasOwnProperty.call(value, 'exclude-dir-from-asset-catalog')) {
				dom.create('exclude-dir-from-asset-catalog', { nodeValue: !!value['exclude-dir-from-asset-catalog'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'enable-launch-screen-storyboard')) {
				dom.create('enable-launch-screen-storyboard', { nodeValue: !!value['enable-launch-screen-storyboard'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'enablecoverage')) {
				dom.create('enablecoverage', { nodeValue: !!value['enablecoverage'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'enablemdfind')) {
				dom.create('enablemdfind', { nodeValue: !!value['enablemdfind'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'min-ios-ver')) {
				dom.create('min-ios-ver', { nodeValue: version.format(value['min-ios-ver'], 2) }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'default-background-color')) {
				dom.create('default-background-color', { nodeValue: value['default-background-color'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'team-id')) {
				dom.create('team-id', { nodeValue: value['team-id'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'use-jscore-framework')) {
				dom.create('use-jscore-framework', { nodeValue: !!value['use-jscore-framework'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'run-on-main-thread')) {
				dom.create('run-on-main-thread', { nodeValue: !!value['run-on-main-thread'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'use-autolayout')) {
				dom.create('use-autolayout', { nodeValue: !!value['use-autolayout'] }, node);
			}

			if (Object.prototype.hasOwnProperty.call(value, 'use-new-build-system')) {
				dom.create('use-new-build-system', { nodeValue: !!value['use-new-build-system'] }, node);
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
				const pl = new plist();
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
				const pl = new plist();
				Object.assign(pl, value.plist);
				const doc = pl.toXml(3);
				plNode.appendChild(dom.createTextNode('\r\n\t\t\t'));
				xml.forEachElement(doc, (elem) => {
					plNode.appendChild(elem);
				});
				plNode.appendChild(dom.createTextNode('\r\n\t\t'));
			}

			if (Array.isArray(value.extensions)) {
				var extsNode = dom.create('extentions', null, node);
				for (const ext of value.extensions) {
					const extNode = dom.create('extention', { projectPath: ext.projectPath }, extsNode);
					if (Array.isArray(ext.targets)) {
						for (const target of ext.targets) {
							const targetNode = dom.create('target', { name: target.name }, extNode);
							if (target.ppUUIDs && typeof target.ppUUIDs === 'object' && Object.keys(target.ppUUIDs).length) {
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
				dom.create('abi', { nodeValue: Array.isArray(value.abi) ? value.abi.join(',') : value.abi }, node);
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

		case 'webpack':
			if (value.type) {
				dom.create('type', { nodeValue: value.type }, node);
			}
			if (Array.isArray(value.transpileDependencies)) {
				dom.create('transpile-dependencies', null, node, depsNode => {
					for (const dep of value.transpileDependencies) {
						dom.create('dep', { nodeValue: dep }, depsNode);
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
						nodeValue: mod.id
					}, node);
				}
			}
			break;

		case 'plugins':
			if (Array.isArray(value)) {
				for (const plugin of value) {
					dom.create('plugin', {
						version: version.format(plugin.version, 2),
						nodeValue: plugin.id
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

function toJS(obj, doc, targetPlatform) {
	let node = doc.firstChild;
	while (node) {
		if (node.nodeType === xml.ELEMENT_NODE) {
			switch (node.tagName) {
				case 'property':
					const name = xml.getAttr(node, 'name');
					const type = xml.getAttr(node, 'type') || 'string';
					const value = xml.getValue(node);
					if (name) {
						if (!obj.properties) {
							obj.properties = {};
						}
						obj.properties[name] = {
							type: type,
							value: type === 'bool' ? !!value
								: type === 'int' ? (parseInt(value) || 0)
									: type === 'double' ? (parseFloat(value) || 0)
										: '' + value
						};
					}
					break;

				case 'deployment-targets':
					const targets = obj['deployment-targets'] = {};
					xml.forEachElement(node, (elem) => {
						const dev = xml.getAttr(elem, 'device');
						if (dev) {
							targets[dev] = xml.getValue(elem);
						}
					});
					break;

				case 'code-processor':
					const codeProcessor = obj['code-processor'] = {};
					xml.forEachElement(node, (elem) => {
						switch (elem.tagName) {
							case 'plugins':
								codeProcessor.plugins = [];
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'plugin') {
										codeProcessor.plugins.push(xml.getValue(elem));
									}
								});
								break;
							case 'options':
								codeProcessor.options = {};
								xml.forEachElement(elem, (elem) => {
									codeProcessor.options[elem.tagName] = xml.getValue(elem);
								});
								break;
							default:
								codeProcessor[elem.tagName] = xml.getValue(elem);
						}
					});
					break;

				case 'ios':
					const ios = obj.ios = {};
					xml.forEachElement(node, (elem) => {
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
								ios[elem.tagName] = xml.getValue(elem);
								break;

							case 'min-ios-ver':
								if (elem.firstChild) {
									ios['min-ios-ver'] = parseFloat(elem.firstChild.data) || 0;
								}
								break;

							case 'capabilities':
								ios.capabilities = {};
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'app-groups') {
										const appGroups = ios.capabilities[elem.tagName] = [];
										xml.forEachElement(elem, (elem) => {
											if (elem.tagName === 'group') {
												const group = xml.getValue(elem);
												if (group) {
													appGroups.push(group);
												}
											}
										});
									}
								});
								break;

							case 'entitlements':
								ios.entitlements = {};
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'dict') {
										const pl = new plist().parse('<plist version="1.0">' + elem.toString() + '</plist>');
										for (const prop of Object.keys(pl)) {
											ios.entitlements[prop] = pl[prop];
										}
									}
								});
								break;

							case 'plist':
								ios.plist = {};
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'dict') {
										const pl = new plist().parse('<plist version="1.0">' + elem.toString() + '</plist>');
										for (const prop of Object.keys(pl)) {
											if (!/^CFBundle(DisplayName|Executable|IconFile|Identifier|InfoDictionaryVersion|Name|PackageType|Signature)|LSRequiresIPhoneOS$/.test(prop)) {
												ios.plist[prop] = pl[prop];
											}
										}
									}
								});
								break;

							case 'extensions':
								const extensions = ios.extensions = [];
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName !== 'extension') {
										return;
									}

									const ext = {
										projectPath: elem.getAttribute('projectPath') || null,
										targets: []
									};
									extensions.push(ext);

									xml.forEachElement(elem, (elem) => {
										if (elem.tagName !== 'target') {
											return;
										}

										const target = {
											name: elem.getAttribute('name'),
											ppUUIDs: {}
										};
										ext.targets.push(target);

										xml.forEachElement(elem, (elem) => {
											if (elem.tagName === 'provisioning-profiles') {
												xml.forEachElement(elem, (elem) => {
													target.ppUUIDs[elem.tagName] = xml.getValue(elem);
												});
											}
										});
									});
								});
								break;
						}
					});
					break;

				case 'iphone':
					const iphone = obj.iphone = {};
					xml.forEachElement(node, (elem) => {
						switch (elem.tagName) {
							case 'orientations':
								if (!iphone.orientations) {
									iphone.orientations = {};
								}
								const dev = xml.getAttr(elem, 'device');
								if (dev) {
									if (!iphone.orientations[dev]) {
										iphone.orientations[dev] = [];
									}
									xml.forEachElement(elem, (elem) => {
										iphone.orientations[dev].push(xml.getValue(elem));
									});
								}
								break;

							case 'background':
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'mode') {
										if (!iphone.backgroundModes) {
											iphone.backgroundModes = [];
										}
										iphone.backgroundModes.push(xml.getValue(elem));
									}
								});
								break;

							case 'requires':
								xml.forEachElement(elem, (elem) => {
									if (elem.tagName === 'feature') {
										if (!iphone.requiredFeatures) {
											iphone.requiredFeatures = [];
										}
										iphone.requiredFeatures.push(xml.getValue(elem));
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
											owner: false
										};
										xml.forEachElement(elem, (elem) => {
											const v = xml.getValue(elem);
											type[elem.tagName] = elem.tagName === 'uti' ? v.split(',').map(s => s.trim()) : v;
										});
										iphone.types.push(type);
									}
								});
								break;
						}
					});
					break;

				case 'android':
					const android = obj.android = {};
					const formatUrl = (url) => {
						return appc.string.capitalize(url.replace(/^app:\/\//, '').replace(/\.js$/, '').replace(/\//g, '_')).replace(/[/ .$&@]/g, '_');
					};

					xml.forEachElement(node, (elem) => {
						switch (elem.tagName) {
							case 'manifest':
								// the <manifest> tag is an XML document and we're just gonna
								// defer the parsing to whoever wants its data
								// Strip the 'android' XML namespace on the uses-sdk tag! It's already defined at <android> tag level!
								android.manifest = elem.toString().replace(/ xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android"/, '');
								break;

							case 'abi':
								android[elem.tagName] = xml.getValue(elem).split(',').map(s => s.trim());
								break;

							case 'tool-api-level':
								android[elem.tagName] = xml.getValue(elem);
								break;

							case 'activities':
							case 'services':
								const type = elem.tagName;
								const dest = android[type] = {};

								xml.forEachElement(elem, (elem) => {
									if ((type === 'activities' && elem.tagName === 'activity') || (type === 'services' && elem.tagName === 'service')) {
										const url = xml.getAttr(elem, 'url') || xml.getValue(elem) || '';
										if (url) {
											const a = dest[url] = {};
											xml.forEachAttr(elem, (attr) => {
												a[attr.name] = xml.parse(attr.value);
											});
											a['classname'] = formatUrl(url) + (type === 'activities' ? 'Activity' : 'Service');
											if (type === 'services') {
												a['type'] = xml.getAttr(elem, 'type') || 'standard';
											}
											a['url'] = url;
											xml.forEachElement(elem, (elem) => {
												if (elem.tagName === 'intent-filter') {
													let intentFilter = null;
													xml.forEachElement(elem, (elem) => {
														if (elem.tagName === 'action' || elem.tagName === 'category' || elem.tagName === 'data') {
															if (!intentFilter) {
																intentFilter = {};
															}
															if (!intentFilter[elem.tagName]) {
																intentFilter[elem.tagName] = [];
															}
															if (elem.tagName === 'data') {
																const a = {};
																xml.forEachAttr(elem, (attr) => {
																	a[attr.name.replace(/^android:/, '')] = xml.parse(attr.value);
																});
																intentFilter[elem.tagName].push(a);
															} else {
																intentFilter[elem.tagName].push(xml.getAttr(elem, 'android:name'));
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
													const obj = {};
													xml.forEachAttr(elem, (attr) => {
														obj[attr.name.replace(/^android:/, '')] = xml.parse(attr.value);
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
					const modules = obj.modules = [];
					xml.forEachElement(node, (elem) => {
						const opts = {
							id: xml.getValue(elem),
							platform: xml.getAttr(elem, 'platform')
						};
						const version = elem.getAttribute('version');
						const deployType = xml.getAttr(elem, 'deploy-type');
						if (version) {
							opts.version = version;
						}
						if (deployType) {
							opts.deployType = deployType;
						}
						modules.push(opts);
					});
					break;

				case 'plugins':
					const plugins = obj.plugins = [];
					xml.forEachElement(node, (elem) => {
						const opts = {
							id: xml.getValue(elem)
						};
						const version = elem.getAttribute('version');
						if (version) {
							opts.version = version;
						}
						plugins.push(opts);
					});
					break;

				case 'version':
					obj[node.tagName] = node.firstChild && node.firstChild.data.replace(/\n/g, '').trim() || '';
					break;

				case 'id':
					if ((targetPlatform && xml.getAttr(node, 'platform') === targetPlatform) || obj[node.tagName] === undefined) {
						obj[node.tagName] = '' + xml.getValue(node);
						if (typeof obj[node.tagName] === 'string') {
							obj[node.tagName] = obj[node.tagName].replace(/\n/g, '');
						}
					}
					break;

				case 'name':
				case 'guid':
				case 'icon':
					// need to strip out line returns which shouldn't be there in the first place
					obj[node.tagName] = '' + xml.getValue(node);
					if (typeof obj[node.tagName] === 'string') {
						obj[node.tagName] = obj[node.tagName].replace(/\n/g, '');
					}
					break;

				case 'webpack':
					const webpack = obj.webpack = {};
					xml.forEachElement(node, elem => {
						switch (elem.tagName) {
							case 'type': {
								webpack[elem.tagName] = xml.getValue(elem);
								break;
							}
							case 'transpile-dependencies': {
								const transpileDependencies = webpack.transpileDependencies = [];
								xml.forEachElement(elem, dep => {
									transpileDependencies.push(xml.getValue(dep));
								});
								break;
							}
						}
					});
					break;

				default:
					obj[node.tagName] = xml.getValue(node);
			}
		}
		node = node.nextSibling;
	}
}

export class tiappxml {
	constructor(filename, platform) {
		this.platform = platform;
		if (filename) {
			this.load(filename);
		}
	}

	load(file) {
		if (!fs.existsSync(file)) {
			throw new Error('tiapp.xml file does not exist');
		}
		toJS(this, (new DOMParser(defaultDOMParserArgs).parseFromString(fs.readFileSync(file).toString(), 'text/xml')).documentElement, this.platform);
		return this;
	}

	parse(str) {
		toJS(this, (new DOMParser(defaultDOMParserArgs).parseFromString(str, 'text/xml')).documentElement, this.platform);
		return this;
	}

	toString(fmt) {
		if (fmt === 'xml') {
			const dom = new DOMParser(defaultDOMParserArgs).parseFromString('<ti:app xmlns:ti="http://ti.tidev.io"/>', 'text/xml');

			dom.create = function (tag, attrs, parent, callback) {
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
			return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml.replace(/uses-sdk xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android"/, 'uses-sdk');
		} else if (fmt === 'pretty-json') {
			return JSON.stringify(this, null, '\t');
		} else if (fmt === 'json') {
			return JSON.stringify(this);
		}
		return Object.prototype.toString.call(this);
	}

	save(file) {
		if (file) {
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, this.toString('xml'));
		}
		return this;
	}
}

export default tiappxml;
