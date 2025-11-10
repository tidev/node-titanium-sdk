import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as environ from './environ.js';

let pluginCache;

/**
 * Scans search paths for Titanium CLI plugins. This function will not scan any
 * paths other than the ones explicitly told to scan.
 * @param {Array<String>} searchPaths - An array of paths to search for Titanium CLI plugins
 * @param {Object} config - The CLI config
 * @param {Object} logger - A logger instance
 * @param {Function} callback - A function to call when done
 */
export function scopedDetect(searchPaths, config, logger, callback) {
	if (!searchPaths || typeof searchPaths !== 'object') {
		callback();
		return;
	}

	Promise.all(
		Object.entries(searchPaths).map(([scope, paths]) => {
			return detectPlugins(paths, config, logger).then(results => ({ [scope]: results }));
		})
	).then(results => callback(Object.assign({}, ...results)));
};

/**
 * Scans a project directory as well as global and user-configured search paths
 * for Titanium CLI plugins.
 * @param {String} projectDir - Path to the project directory
 * @param {Object} config - The CLI config
 * @param {Object} logger - A logger instance
 * @param {Function} callback - A function to call when done
 * @param {boolean} bypassCache - whether to bypass the cache
 * @returns {void}
 */
export function detect(projectDir, config, logger, callback, bypassCache) {
	if (pluginCache && !bypassCache) {
		return callback(pluginCache);
	}

	Promise.all([
		detectPlugins(path.join(projectDir, 'plugins'), config, logger).then(results => ({ project: results })),

		config.paths && Array.isArray(config.paths.plugins)
			? detectPlugins(config.paths.plugins, config, logger).then(results => ({ user: results })) : null,

		detectPlugins(environ.os.sdkPaths.map(p => path.join(p, 'plugins')), config, logger).then(results => ({ global: results }))
	]).then(results => callback(pluginCache = Object.assign({}, ...results)));
};

/**
 * Detects all installed Titanium CLI plugins, then it will validate that the
 * specified plugins are found or missing.
 * @param {Array<Object>} plugins - An array of plugins to search for
 * @param {Object|String} searchPaths - An object containing search paths or the
 * path to the project directory
 * @param {Object} config - The CLI config
 * @param {Object} logger - A logger instance
 * @param {Function} callback - A function to call when done
 * @returns {void}
 */
export function find(plugins, searchPaths, config, logger, callback) {
	// if there are plugins to find, then just exit now
	if (!plugins || !plugins.length) {
		return callback({
			found: [],
			missing: []
		});
	}

	function process(installed) {
		const result = {
			found: [],
			missing: []
		};
		const visited = {};

		for (const plugin of plugins) {
			const originalVersion = plugin.version || 'latest',
				scopes = [ 'project', 'config', 'user', 'global' ]; // the order here represents precendence ('user' is legacy, now we use 'config')

			if (!plugin.version) {
				for (const scope of scopes) {
					// search both project and global plugins for the latest version
					const x = installed[scope];
					if (!plugin.version && x?.[plugin.id]) {
						plugin.version = Object.keys(x[plugin.id]).sort().pop();
					}
				}
			}

			const key = plugin.id + '|' + plugin.version;
			if (visited[key]) {
				return;
			}
			visited[key] = 1;

			logger?.debug(`Looking for Titanium plugin id=${plugin.id} version=${originalVersion}`);

			let found;
			for (let i = 0; !found && i < scopes.length; i++) {
				const scope = installed[scopes[i]];
				if (scope && scope[plugin.id]) {
					const info = scope[plugin.id][plugin.version] || scope[plugin.id]['unknown'] || scope[plugin.id]['-'];
					if (info) {
						Object.assign(plugin, info);
						logger?.info(`Found Titanium plugin id=${plugin.id} version=${originalVersion}`);
						result.found.push(plugin);
						found = true;
					}
				}
			}

			if (!found) {
				logger?.warn(`Could not find Titanium plugin id=${plugin.id} version=${originalVersion}`);
				result.missing.push(plugin);
			}
		}

		callback(result);
	}

	if (typeof searchPaths === 'string') {
		// searchPaths is the project directory
		detect(searchPaths, config, logger, process);
	} else {
		// searchPaths is an object of paths
		scopedDetect(searchPaths, config, logger, process);
	}
};

/**
 * Searches an array of paths for Titanium CLI plugins.
 * @param {Array<String>} searchPaths - An array of paths to search for Titanium CLI plugins
 * @param {Object} config - The CLI config
 * @param {Object} logger - A logger instance
 * @private
 */
async function detectPlugins(searchPaths, config, logger) {
	const results = {};
	const ignoreDirs = new RegExp(config?.get('cli.ignoreDirs') || '^(.svn|.git|.hg|.?[Cc][Vv][Ss]|.bzr)$');

	if (!Array.isArray(searchPaths)) {
		searchPaths = [ searchPaths ];
	}

	for (const pluginRoot of searchPaths) {
		pluginRoot = path.resolve(pluginRoot);
		if (!fs.existsSync(pluginRoot)) {
			continue;
		}

		logger?.debug(`Detecting plugins in ${pluginRoot}`);

		const packageFile = path.join(pluginRoot, 'package.json');
		const packageFileExists = fs.existsSync(packageFile);
		const pluginFile = path.join(pluginRoot, 'plugin.py');
		const pluginFileExists = fs.existsSync(pluginFile);
		const pluginName = path.basename(pluginRoot);

		// check if this search path is plugin folder
		if (packageFileExists || pluginFileExists) {
			// we have a plugin without a version folder
			const plugin = results[pluginName];
			if (!plugin) {
				plugin = results[pluginName] = {};
			}
			plugin['-'] = {
				pluginPath: pluginRoot
			};

			if (packageFileExists) {
				try {
					plugin['-'].manifest = JSON.parse(fs.readFileSync(packageFile));
				} catch {}
			}

			if (pluginFileExists) {
				plugin['-'].legacyPluginFile = pluginFile;
			}

			logger?.debug(`Detected plugin: ${pluginName} @ ${pluginRoot}`);
			continue;
		}

		// loop through plugin names
		for (const pluginName of fs.readdirSync(pluginRoot)) {
			const pluginsPath = path.join(pluginRoot, pluginName);
			if (!fs.existsSync(pluginsPath) || !fs.statSync(pluginsPath).isDirectory() || ignoreDirs.test(pluginName)) {
				continue;
			}

			// we have a plugin directory

			const processDir = async (ver, versionPath, dest) => {
				const packageFile = path.join(versionPath, 'package.json');
				const packageFileExists = fs.existsSync(packageFile);
				const pluginFile = path.join(versionPath, 'plugin.py');
				const pluginFileExists = fs.existsSync(pluginFile);
				const jsfile = /\.js$/;
				const ignore = /^[._]/;

				dest.pluginPath = versionPath;
				dest.commands = [];
				dest.hooks = [];
				dest.legacyPluginFile = pluginFileExists ? pluginFile : null;
				dest.manifest = {};

				if (packageFileExists) {
					try {
						dest.manifest = JSON.parse(fs.readFileSync(packageFile));
					} catch {}
				}

				const commandsDir = path.join(versionPath, 'commands');
				if (fs.existsSync(commandsDir) && fs.statSync(commandsDir).isDirectory()) {
					for (const filename of fs.readdirSync(commandsDir)) {
						const file = path.join(commandsDir, filename);
						if (fs.statSync(file).isFile() && jsfile.test(filename) && !ignore.test(filename)) {
							dest.commands.push({
								name: filename.replace(jsfile, '')
							});
						}
					}
				}

				const hooksDir = path.join(versionPath, 'hooks');
				if (fs.existsSync(hooksDir) && fs.statSync(hooksDir).isDirectory()) {
					for (const filename of fs.readdirSync(hooksDir)) {
						const file = path.join(hooksDir, filename);
						if (fs.statSync(file).isFile() && jsfile.test(filename) && !ignore.test(filename)) {
							const info = {
								name: filename.replace(jsfile, ''),
								path: file
							};

							try {
								vm.runInThisContext(`(function (exports, require, module, __filename, __dirname) { ${fs.readFileSync(file).toString()}\n});`, file, 0, false);
								const {default: mod} = await import(file);
								if (mod.name) {
									info.name = mod.name;
								}
								if (mod.cliVersion) {
									info.cliVersion = mod.cliVersion;
								}
								if (mod.version) {
									info.version = mod.version;
								}
							} catch {}

							dest.hooks.push(info);
						}
					}
				}

				if (ver) {
					logger?.debug(`Detected plugin: ${pluginName} ${ver} @ ${versionPath}`);
				} else {
					logger?.debug(`Detected plugin: ${pluginName} @ ${versionPath}`);
				}
			};

			const packageFileExists = fs.existsSync(path.join(pluginsPath, 'package.json'));
			const pluginName = path.basename(pluginsPath);

			if (packageFileExists || fs.existsSync(path.join(pluginsPath, 'plugin.py'))) {
				// we have a plugin without a version folder or a project level plugin
				if (!results[pluginName]) {
					results[pluginName] = {};
				}
				await processDir(null, pluginsPath, results[pluginName].unknown = {});
			} else {
				// loop through versions
				for (const ver of fs.readdirSync(pluginsPath)) {
					const dir = path.join(pluginsPath, ver);
					if (!ignoreDirs.test(ver) && fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
						if (!results[pluginName]) {
							results[pluginName] = {};
						}
						await processDir(ver, dir, results[pluginName][ver] = {});
					}
				}
			}
		}
	}

	return results;
}
