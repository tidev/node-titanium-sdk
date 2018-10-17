/**
 * Titanium SDK Library for Node.js
 * Copyright (c) 2012-Present by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */
/* eslint no-loop-func: "off" */
'use strict';

const appc = require('node-appc');
const DOMParser = require('xmldom').DOMParser;
const fs = require('fs-extra');
const path = require('path');

const plist = appc.plist;
const version = appc.version;
const xml = appc.xml;
const __ = appc.i18n(__dirname).__;

const defaultDOMParserArgs = { errorHandler: function () {} };

module.exports = tiapp;

function toXml(dom, parent, name, value) {
	// properties is a super special case
	if (name === 'properties') {
		Object.keys(value).forEach(function (v) {
			dom.create('property', {
				name: v,
				type: value[v].type || 'string',
				nodeValue: value[v].value
			}, parent);
		});
		return;
	}

	var node = dom.create(name, null, parent);

	switch (name) {
		case 'deployment-targets':
			Object.keys(value).forEach(function (v) {
				dom.create('target', {
					device: v,
					nodeValue: value[v]
				}, node);
			});
			break;

		case 'code-processor':
			Object.keys(value).forEach(function (key) {
				if (key === 'plugins') {
					if (Array.isArray(value[key]) && value[key].length) {
						dom.create('plugins', null, node, function (plugins) {
							value[key].forEach(function (p) {
								dom.create('plugin', { nodeValue: p }, plugins);
							});
						});
					}
				} else if (key === 'options') {
					if (Object.prototype.toString.call(value[key]) === '[object Object]') {
						dom.create('options', null, node, function (options) {
							Object.keys(value[key]).forEach(function (opt) {
								dom.create(opt, { nodeValue: value[key][opt] }, options);
							});
						});
					}
				} else {
					dom.create(key, { nodeValue: value[key] }, node);
				}
			});
			break;

		case 'ios':
			if (value.hasOwnProperty('enable-launch-screen-storyboard')) {
				dom.create('enable-launch-screen-storyboard', { nodeValue: !!value['enable-launch-screen-storyboard'] }, node);
			}

			if (value.hasOwnProperty('enablecoverage')) {
				dom.create('enablecoverage', { nodeValue: !!value['enablecoverage'] }, node);
			}

			if (value.hasOwnProperty('enablemdfind')) {
				dom.create('enablemdfind', { nodeValue: !!value['enablemdfind'] }, node);
			}

			if (value.hasOwnProperty('min-ios-ver')) {
				dom.create('min-ios-ver', { nodeValue: version.format(value['min-ios-ver'], 2) }, node);
			}

			if (value.hasOwnProperty('default-background-color')) {
				dom.create('default-background-color', { nodeValue: value['default-background-color'] }, node);
			}

			if (value.hasOwnProperty('team-id')) {
				dom.create('team-id', { nodeValue: value['team-id'] }, node);
			}

			if (value.hasOwnProperty('use-jscore-framework')) {
				dom.create('use-jscore-framework', { nodeValue: !!value['use-jscore-framework'] }, node);
			}

			if (value.hasOwnProperty('run-on-main-thread')) {
				dom.create('run-on-main-thread', { nodeValue: !!value['run-on-main-thread'] }, node);
			}

			if (value.hasOwnProperty('use-autolayout')) {
				dom.create('use-autolayout', { nodeValue: !!value['use-autolayout'] }, node);
			}

			if (value.hasOwnProperty('use-new-build-system')) {
				dom.create('use-new-build-system', { nodeValue: !!value['use-new-build-system'] }, node);
			}

			if (value.hasOwnProperty('use-app-thinning')) {
				dom.create('use-app-thinning', { nodeValue: !!value['use-app-thinning'] }, node);
			}

			if (value.hasOwnProperty('log-server-port')) {
				dom.create('log-server-port', { nodeValue: value['log-server-port'] }, node);
			}

			if (value.capabilities) {
				var capNode = dom.create('capabilities', null, node);
				Object.keys(value.capabilities).forEach(function (cap) {
					if (cap === 'app-groups') {
						var appGroupNode = dom.create(cap, null, capNode);
						value.capabilities[cap].forEach(function (group) {
							dom.create('group', { nodeValue: group }, appGroupNode);
						});
						appGroupNode.appendChild(dom.createTextNode('\r\n\t\t\t'));
						capNode.appendChild(dom.createTextNode('\r\n\t\t'));
					}
				});
			}

			if (value.entitlements) {
				const enNode = dom.create('entitlements', null, node);
				const pl = new plist();
				appc.util.mix(pl, value.entitlements);
				const doc = pl.toXml(3);
				enNode.appendChild(dom.createTextNode('\r\n\t\t\t'));
				xml.forEachElement(doc, function (elem) {
					enNode.appendChild(elem);
				});
				enNode.appendChild(dom.createTextNode('\r\n\t\t'));
			}

			if (value.plist) {
				const plNode = dom.create('plist', null, node);
				const pl = new plist();
				appc.util.mix(pl, value.plist);
				const doc = pl.toXml(3);
				plNode.appendChild(dom.createTextNode('\r\n\t\t\t'));
				xml.forEachElement(doc, function (elem) {
					plNode.appendChild(elem);
				});
				plNode.appendChild(dom.createTextNode('\r\n\t\t'));
			}

			if (Array.isArray(value.extensions)) {
				var extsNode = dom.create('extentions', null, node);
				value.extensions.forEach(function (ext) {
					var extNode = dom.create('extention', { projectPath: ext.projectPath }, extsNode);
					Array.isArray(ext.targets) && ext.targets.forEach(function (target) {
						var targetNode = dom.create('target', { name: target.name }, extNode);
						if (target.ppUUIDs && typeof target.ppUUIDs === 'object' && Object.keys(target.ppUUIDs).length) {
							var ppUUIDsNode = dom.create('provisioning-profiles', null, targetNode);
							Object.keys(target.ppUUIDs).forEach(function (type) {
								dom.create(type, { nodeValue: target.ppUUIDs[type] }, ppUUIDsNode);
							});
							ppUUIDsNode.appendChild(dom.createTextNode('\r\n\t\t\t\t\t'));
						}
						targetNode.appendChild(dom.createTextNode('\r\n\t\t\t\t'));
					});
					extNode.appendChild(dom.createTextNode('\r\n\t\t\t'));
				});
				extsNode.appendChild(dom.createTextNode('\r\n\t\t'));
			}
			break;

		case 'iphone':
			value.orientations && Object.keys(value.orientations).forEach(function (o) {
				dom.create('orientations', { device: o }, node, function (orientations) {
					value.orientations[o].forEach(function (p) {
						dom.create('orientation', { nodeValue: p }, orientations);
					});
				});
			});

			value.backgroundModes && dom.create('background', null, node, function (background) {
				value.backgroundModes.forEach(function (mode) {
					dom.create('mode', { nodeValue: mode }, background);
				});
			});

			value.requiredFeatures && dom.create('requires', null, node, function (requires) {
				value.requiredFeatures.forEach(function (feature) {
					dom.create('feature', { nodeValue: feature }, requires);
				});
			});

			value.types && dom.create('types', null, node, function (types) {
				value.types.forEach(function (typeObj) {
					dom.create('type', null, types, function (typeNode) {
						dom.create('name', { nodeValue: typeObj.name }, typeNode);
						dom.create('icon', { nodeValue: typeObj.icon }, typeNode);
						dom.create('uti', { nodeValue: typeObj.uti.join(',') }, typeNode);
						dom.create('owner', { nodeValue: !!typeObj.owner }, typeNode);
					});
				});
			});
			break;

		case 'android':
			node.setAttribute('xmlns:android', 'http://schemas.android.com/apk/res/android');

			if (value.manifest) {
				node.appendChild(dom.createTextNode('\r\n' + new Array(3).join('\t')));
				const opts = defaultDOMParserArgs;
				opts.xmlns = { android: 'http://schemas.android.com/apk/res/android' };
				node.appendChild(new DOMParser(opts).parseFromString(value.manifest));
			}

			if (value.hasOwnProperty('tool-api-level')) {
				dom.create('tool-api-level', { nodeValue: value['tool-api-level'] }, node);
			}

			if (value.hasOwnProperty('abi')) {
				dom.create('abi', { nodeValue: Array.isArray(value.abi) ? value.abi.join(',') : value.abi }, node);
			}

			if (value.activities) {
				dom.create('activities', null, node, function (node) {
					Object.keys(value.activities).forEach(function (url) {
						var attrs = {};
						Object.keys(value.activities[url]).forEach(function (attr) {
							attr !== 'classname' && (attrs[attr] = value.activities[url][attr]);
						});
						dom.create('activity', attrs, node);
					});
				});
			}

			if (value.services) {
				dom.create('services', null, node, function (node) {
					Object.keys(value.services).forEach(function (url) {
						var attrs = {};
						Object.keys(value.services[url]).forEach(function (attr) {
							attr !== 'classname' && (attrs[attr] = value.services[url][attr]);
						});
						dom.create('service', attrs, node);
					});
				});
			}
			break;

		case 'mobileweb':
			Object.keys(value).forEach(function (prop) {
				switch (prop) {
					case 'build':
						dom.create('build', null, node, function (build) {
							Object.keys(value.build).forEach(function (name) {
								dom.create(name, null, build, function (deployment) {
									Object.keys(value.build[name]).forEach(function (d) {
										var val = value.build[name][d];
										switch (d) {
											case 'js':
											case 'css':
											case 'html':
												dom.create(d, null, deployment, function (type) {
													Object.keys(val).forEach(function (v) {
														dom.create(v, { nodeValue: val[v] }, type);
													});
												});
												break;

											default:
												dom.create(d, { nodeValue: val }, deployment);
										}
									});
								});
							});
						});
						break;

					case 'analytics':
					case 'filesystem':
					case 'map':
					case 'splash':
					case 'unsupported-platforms':
						dom.create(prop, null, node, function (section) {
							Object.keys(value[prop]).forEach(function (key) {
								dom.create(key, { nodeValue: value[prop][key] }, section);
							});
						});
						break;

					case 'precache':
						dom.create('precache', null, node, function (precache) {
							Object.keys(value[prop]).forEach(function (type) {
								value[prop][type].forEach(function (n) {
									dom.create(type, { nodeValue: n }, precache);
								});
							});
						});
						break;

					default:
						dom.create(prop, { nodeValue: value[prop] }, node);
				}
			});
			break;

		case 'tizen':
			node.setAttribute('xmlns:tizen', 'http://ti.appcelerator.org');
			// use default and generated values if appid and configXml are empty
			value.appid && node.setAttribute('appid', value.appid);
			// creating nodes from tizen specific entries
			var tizenSection = new DOMParser(defaultDOMParserArgs).parseFromString('<?xml version="1.0" encoding="UTF-8"?>\n<tizen xmlns:tizen="http://ti.appcelerator.org" appid="' + value.appid + '"> ' + value.configXml + ' </tizen>', 'text/xml').documentElement,
				child = tizenSection.firstChild,
				nextSibl;
			while (child) {
				// store next sibling before calling nextSibling().
				// Becaus after appendChild() nextSibling() will return node from other tree
				nextSibl = child.nextSibling;
				node.appendChild(child);
				child = nextSibl;
			}
			break;

		case 'windows':
			Object.keys(value).forEach(function (prop) {
				switch (prop) {
					default:
						dom.create(prop, { nodeValue: value[prop] }, node);
				}
			});
			break;

		case 'windows-phone':
			Object.keys(value).forEach(function (prop) {
				switch (prop) {
					default:
						dom.create(prop, { nodeValue: value[prop] }, node);
				}
			});
			break;

		case 'modules':
			value.forEach(function (mod) {
				dom.create('module', {
					platform: mod.platform,
					version: mod.version ? version.format(mod.version, 2) : null,
					'deploy-type': mod.deployType || null,
					nodeValue: mod.id
				}, node);
			});
			break;

		case 'plugins':
			value.forEach(function (plugin) {
				dom.create('plugin', {
					version: version.format(plugin.version, 2),
					nodeValue: plugin.id
				}, node);
			});
			break;

		default:
			node.appendChild(dom.createTextNode(value));
			return;
	}

	node.appendChild(dom.createTextNode('\r\n' + new Array(2).join('\t')));
}

function toJS(obj, doc) {
	var node = doc.firstChild;
	while (node) {
		if (node.nodeType === xml.ELEMENT_NODE) {
			switch (node.tagName) {
				case 'property':
					var name = xml.getAttr(node, 'name'),
						type = xml.getAttr(node, 'type') || 'string',
						value = xml.getValue(node);
					if (name) {
						obj.properties || (obj.properties = {});
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
					var targets = obj['deployment-targets'] = {};
					xml.forEachElement(node, function (elem) {
						var dev = xml.getAttr(elem, 'device');
						dev && (targets[dev] = xml.getValue(elem));
					});
					break;

				case 'code-processor':
					var codeProcessor = obj['code-processor'] = {};
					xml.forEachElement(node, function (elem) {
						switch (elem.tagName) {
							case 'plugins':
								codeProcessor.plugins = [];
								xml.forEachElement(elem, function (elem) {
									if (elem.tagName === 'plugin') {
										codeProcessor.plugins.push(xml.getValue(elem));
									}
								});
								break;
							case 'options':
								codeProcessor.options = {};
								xml.forEachElement(elem, function (elem) {
									codeProcessor.options[elem.tagName] = xml.getValue(elem);
								});
								break;
							default:
								codeProcessor[elem.tagName] = xml.getValue(elem);
						}
					});
					break;

				case 'ios':
					var ios = obj.ios = {};
					xml.forEachElement(node, function (elem) {
						switch (elem.tagName) {
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
								xml.forEachElement(elem, function (elem) {
									if (elem.tagName === 'app-groups') {
										var appGroups = ios.capabilities[elem.tagName] = [];
										xml.forEachElement(elem, function (elem) {
											if (elem.tagName === 'group') {
												var group = xml.getValue(elem);
												group && appGroups.push(group);
											}
										});
									}
								});
								break;

							case 'entitlements':
								ios.entitlements = {};
								xml.forEachElement(elem, function (elem) {
									if (elem.tagName === 'dict') {
										const pl = new plist().parse('<plist version="1.0">' + elem.toString() + '</plist>');
										Object.keys(pl).forEach(prop => ios.entitlements[prop] = pl[prop]);
									}
								});
								break;

							case 'plist':
								ios.plist = {};
								xml.forEachElement(elem, function (elem) {
									if (elem.tagName === 'dict') {
										var pl = new plist().parse('<plist version="1.0">' + elem.toString() + '</plist>');
										Object.keys(pl).forEach(function (prop) {
											if (!/^CFBundle(DisplayName|Executable|IconFile|Identifier|InfoDictionaryVersion|Name|PackageType|Signature)|LSRequiresIPhoneOS$/.test(prop)) {
												ios.plist[prop] = pl[prop];
											}
										});
									}
								});
								break;

							case 'extensions':
								var extensions = ios.extensions = [];
								xml.forEachElement(elem, function (elem) {
									if (elem.tagName !== 'extension') {
										return;
									}

									var ext = {
										projectPath: elem.getAttribute('projectPath') || null,
										targets: []
									};
									extensions.push(ext);

									xml.forEachElement(elem, function (elem) {
										if (elem.tagName !== 'target') {
											return;
										}

										var target = {
											name: elem.getAttribute('name'),
											ppUUIDs: {}
										};
										ext.targets.push(target);

										xml.forEachElement(elem, function (elem) {
											if (elem.tagName === 'provisioning-profiles') {
												xml.forEachElement(elem, function (elem) {
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

				case 'blackberry':
					var blackberry = obj.blackberry = {};
					obj.blackberry.other = '';
					xml.forEachElement(node, function (elem) {
						switch (elem.tagName) {
							case 'permissions':
								const permissions = blackberry.permissions = {};
								xml.forEachElement(elem, (e) => permissions[xml.getValue(e)] = true);
								break;

							case 'build-id':
							case 'orientation':
								blackberry[elem.tagName] = xml.getValue(elem);
								break;

							default:
								obj.blackberry.other += elem.toString() + '\n';
						}
					});
					break;

				case 'iphone':
					var iphone = obj.iphone = {},
						dev;
					xml.forEachElement(node, function (elem) {
						switch (elem.tagName) {
							case 'orientations':
								iphone.orientations || (iphone.orientations = {});
								if (dev = xml.getAttr(elem, 'device')) {
									iphone.orientations[dev] || (iphone.orientations[dev] = []);
									xml.forEachElement(elem, function (elem) {
										iphone.orientations[dev].push(xml.getValue(elem));
									});
								}
								break;

							case 'background':
								xml.forEachElement(elem, function (elem) {
									if (elem.tagName === 'mode') {
										iphone.backgroundModes || (iphone.backgroundModes = []);
										iphone.backgroundModes.push(xml.getValue(elem));
									}
								});
								break;

							case 'requires':
								xml.forEachElement(elem, function (elem) {
									if (elem.tagName === 'feature') {
										iphone.requiredFeatures || (iphone.requiredFeatures = []);
										iphone.requiredFeatures.push(xml.getValue(elem));
									}
								});
								break;

							case 'types':
								xml.forEachElement(elem, function (elem) {
									if (elem.tagName === 'type') {
										iphone.types || (iphone.types = []);
										var type = {
											name: '',
											icon: '',
											uti: [],
											owner: false
										};
										xml.forEachElement(elem, function (elem) {
											var v = xml.getValue(elem);
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
					var android = obj.android = {},
						formatUrl = (url) => {
							return appc.string.capitalize(url.replace(/^app:\/\//, '').replace(/\.js$/, '').replace(/\//g, '_')).replace(/[/ .$&@]/g, '_');
						};

					xml.forEachElement(node, function (elem) {
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
								var type = elem.tagName,
									dest = android[type] = {};

								xml.forEachElement(elem, function (elem) {
									if ((type === 'activities' && elem.tagName === 'activity') || (type === 'services' && elem.tagName === 'service')) {
										var url = xml.getAttr(elem, 'url') || xml.getValue(elem) || '';
										if (url) {
											var a = dest[url] = {};
											xml.forEachAttr(elem, function (attr) {
												a[attr.name] = xml.parse(attr.value);
											});
											a['classname'] = formatUrl(url) + (type === 'activities' ? 'Activity' : 'Service');
											if (type === 'services') {
												a['type'] = xml.getAttr(elem, 'type') || 'standard';
											}
											a['url'] = url;
											xml.forEachElement(elem, function (elem) {
												if (elem.tagName === 'intent-filter') {
													var intentFilter = null;
													xml.forEachElement(elem, function (elem) {
														if (elem.tagName === 'action' || elem.tagName === 'category' || elem.tagName === 'data') {
															intentFilter || (intentFilter = {});
															intentFilter[elem.tagName] || (intentFilter[elem.tagName] = []);
															if (elem.tagName === 'data') {
																var a = {};
																xml.forEachAttr(elem, function (attr) {
																	a[attr.name.replace(/^android:/, '')] = xml.parse(attr.value);
																});
																intentFilter[elem.tagName].push(a);
															} else {
																intentFilter[elem.tagName].push(xml.getAttr(elem, 'android:name'));
															}
														}
													});
													if (intentFilter) {
														a['intent-filter'] || (a['intent-filter'] = []);
														a['intent-filter'].push(intentFilter);
													}
												} else if (elem.tagName === 'meta-data') {
													var obj = {};
													xml.forEachAttr(elem, function (attr) {
														obj[attr.name.replace(/^android:/, '')] = xml.parse(attr.value);
													});
													if (obj.name) {
														a['meta-data'] || (a['meta-data'] = {});
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

				case 'mobileweb':
					var mobileweb = obj.mobileweb = {};
					xml.forEachElement(node, function (elem) {
						switch (elem.tagName) {
							case 'build':
								var build = mobileweb.build = {};
								xml.forEachElement(elem, function (elem) {
									var profile = build[elem.tagName] = {};
									xml.forEachElement(elem, function (elem) {
										switch (elem.tagName) {
											case 'js':
											case 'css':
											case 'html':
												var filetype = profile[elem.tagName] = {};
												xml.forEachElement(elem, function (elem) {
													filetype[elem.tagName] = xml.getValue(elem);
												});
												break;

											default:
												profile[elem.tagName] = xml.getValue(elem);
										}
									});
								});
								break;

							case 'analytics':
							case 'filesystem':
							case 'map':
							case 'splash':
							case 'unsupported-platforms':
								mobileweb[elem.tagName] = {};
								xml.forEachElement(elem, function (subelem) {
									mobileweb[elem.tagName][subelem.tagName] = xml.getValue(subelem);
								});
								break;

							case 'precache':
								var precache = mobileweb.precache = {};
								xml.forEachElement(elem, function (elem) {
									precache[elem.tagName] || (precache[elem.tagName] = []);
									precache[elem.tagName].push(xml.getValue(elem));
								});
								break;

							default:
								mobileweb[elem.tagName] = xml.getValue(elem);
						}
					});
					break;

				case 'tizen':
					var tizen = obj.tizen = {
						appid: undefined,
						configXml: undefined
					};

					tizen.appid = xml.getAttr(node, 'appid');
					xml.forEachElement(node, function (elem) {
						tizen.configXml ? tizen.configXml = tizen.configXml + '\n' + elem.toString() : tizen.configXml = elem.toString();
					});
					break;

				case 'windows':
					var windows = obj.windows = {};
					xml.forEachElement(node, function (elem) {
						windows[elem.tagName] = xml.getValue(elem);
					});
					break;

				case 'windows-phone':
					var wp = obj['windows-phone'] = {};
					xml.forEachElement(node, function (elem) {
						switch (elem.tagName) {
							case 'target-sdk':
								wp[elem.tagName] = elem.firstChild && elem.firstChild.data.replace(/\n/g, '').trim() || '';
								break;
							default:
								wp[elem.tagName] = xml.getValue(elem);
						}
					});
					break;

				case 'modules':
					var modules = obj.modules = [];
					xml.forEachElement(node, function (elem) {
						var opts = {
								id: xml.getValue(elem),
								platform: xml.getAttr(elem, 'platform')
							},
							version = elem.getAttribute('version'),
							deployType = xml.getAttr(elem, 'deploy-type');
						version && (opts.version = version);
						deployType && (opts.deployType = deployType);
						modules.push(opts);
					});
					break;

				case 'plugins':
					var plugins = obj.plugins = [];
					xml.forEachElement(node, function (elem) {
						var opts = {
								id: xml.getValue(elem)
							},
							version = elem.getAttribute('version');
						version && (opts.version = version);
						plugins.push(opts);
					});
					break;

				case 'version':
					obj[node.tagName] = node.firstChild && node.firstChild.data.replace(/\n/g, '').trim() || '';
					break;

				case 'name':
				case 'guid':
				case 'id':
				case 'icon':
					// need to strip out line returns which shouldn't be there in the first place
					obj[node.tagName] = '' + xml.getValue(node);
					if (typeof obj[node.tagName] === 'string') {
						obj[node.tagName] = obj[node.tagName].replace(/\n/g, '');
					}
					break;

				default:
					obj[node.tagName] = xml.getValue(node);
			}
		}
		node = node.nextSibling;
	}
}

function tiapp(filename) {
	Object.defineProperty(this, 'load', {
		value: function (file) {
			if (!fs.existsSync(file)) {
				throw new Error(__('tiapp.xml file does not exist'));
			}
			toJS(this, (new DOMParser(defaultDOMParserArgs).parseFromString(fs.readFileSync(file).toString(), 'text/xml')).documentElement);
			return this;
		}
	});

	Object.defineProperty(this, 'parse', {
		value: function (str) {
			toJS(this, (new DOMParser(defaultDOMParserArgs).parseFromString(str, 'text/xml')).documentElement);
			return this;
		}
	});

	Object.defineProperty(this, 'toString', {
		value: function (fmt) {
			if (fmt === 'xml') {
				var dom = new DOMParser(defaultDOMParserArgs).parseFromString('<ti:app xmlns:ti="http://ti.appcelerator.org"/>', 'text/xml');

				dom.create = function (tag, attrs, parent, callback) {
					var node = dom.createElement(tag),
						i = 0,
						p = parent;

					attrs && Object.keys(attrs).forEach(function (attr) {
						if (attr === 'nodeValue') {
							node.appendChild(dom.createTextNode('' + attrs[attr]));
						} else {
							attrs[attr] != undefined && node.setAttribute(attr, '' + attrs[attr]); // eslint-disable-line eqeqeq
						}
					});

					if (p) {
						while (p.parentNode) {
							i++;
							p = p.parentNode;
						}
						parent.appendChild(dom.createTextNode('\r\n' + new Array(i + 1).join('\t')));
					}

					parent && parent.appendChild(node);
					if (callback) {
						callback(node);
						node.appendChild(dom.createTextNode('\r\n' + new Array(i + 1).join('\t')));
					}
					return node;
				};

				Object.keys(this).forEach(function (key) {
					toXml(dom, dom.documentElement, key, this[key]);
				}, this);

				dom.documentElement.appendChild(dom.createTextNode('\r\n'));

				var xml = dom.documentElement.toString();
				return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml.replace(/uses-sdk xmlns:android="http:\/\/schemas\.android\.com\/apk\/res\/android"/, 'uses-sdk');
			} else if (fmt === 'pretty-json') {
				return JSON.stringify(this, null, '\t');
			} else if (fmt === 'json') {
				return JSON.stringify(this);
			}
			return Object.prototype.toString.call(this);
		}
	});

	Object.defineProperty(this, 'save', {
		value: function (file) {
			if (file) {
				fs.ensureDirSync(path.dirname(file));
				fs.writeFileSync(file, this.toString('xml'));
			}
			return this;
		}
	});

	filename && this.load(filename);
}
