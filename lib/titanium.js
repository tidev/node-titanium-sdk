import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { tiappxml } from './tiappxml';
import { find as findTiPlugins } from './tiplugin.js';
import * as version from './version.js';
import { fileURLToPath } from 'node:url';
import { loadManifestJson } from './util/load-manifest-json.js';

export const manifest = loadManifestJson(path.dirname(fileURLToPath(import.meta.url)));
const platformAliases = {
	// add additional aliases here for new platforms
	ipad: 'iphone',
	ios: 'iphone'
};

import * as i18n from './i18n.js';
import { suggest } from './util/suggest.js';
export { i18n };
export { tiappxml };

export const platforms = [...manifest.platforms];
export const targetPlatforms = (manifest.platforms || []).map(p => {
	return p === 'iphone' ? 'ios' : p;
}).sort();
export const availablePlatforms = (manifest.platforms || []).sort();

export const availablePlatformsNames = (platforms => {
	for (const alias of Object.keys(platformAliases)) {
		if (platforms.includes(platformAliases[alias])) {
			platforms.push(alias);
		}
	}
	return platforms.sort();
})(manifest.platforms || []);

export async function platformOptions(logger, config, cli, commandName) {
	const result = {};
	let targetPlatform = !cli.argv.help && (cli.argv.platform || cli.argv.p);

	if (!commandName) {
		return result;
	}

	function set(obj, title, platform) {
		// add the platform and title to the options and flags
		for (const type of [ 'options', 'flags' ]) {
			if (obj && obj[type]) {
				if (!result[platform]) {
					result[platform] = {
						platform: platform,
						title: title || platform
					};
				}
				result[platform][type] = obj[type];
			}
		}
	}

	// translate the platform name
	targetPlatform = platformAliases[targetPlatform] || targetPlatform;

	// for each platform, fetch their specific flags/options
	return await Promise.all(manifest.platforms.map(async (platform) => {
		// only configure target platform
		if (targetPlatform && platform !== targetPlatform) {
			return;
		}

		const platformDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', platform);
		const platformCommand = path.join(platformDir, 'cli', 'commands', `_${commandName}.js`);
		let command, conf, title;

		if (!fs.existsSync(platformCommand)) {
			return;
		}

		command = (await import(platformCommand)).default;
		if (!command || !command.config) {
			return;
		}

		// try to get the platform specific configuration
		conf = command.config(logger, config, cli);

		try {
			// try to read a title from the platform's package.json
			title = JSON.parse(fs.readFileSync(path.join(platformDir, 'package.json'))).title;
		} catch {}

		await new Promise((resolve) => {
			if (typeof conf === 'function') {
				// async callback
				conf((obj) => {
					set(obj, title, platform);
					resolve();
				});
				return;
			}

			set(conf, title, platform);
			resolve();
		});
	}));
}

export function validateProjectDir(logger, cli, argv, name) {
	const dir = argv[name] || (process.env.SOURCE_ROOT ? path.join(process.env.SOURCE_ROOT, '..', '..') : '.');
	let projectDir = argv[name] = expand(dir);

	if (!fs.existsSync(projectDir)) {
		logger.banner();
		logger.error('Project directory does not exist\n');
		process.exit(1);
	}

	let tiapp = path.join(projectDir, 'tiapp.xml');
	while (!fs.existsSync(tiapp) && tiapp.split(path.sep).length > 2) {
		projectDir = argv[name] = path.dirname(projectDir);
		tiapp = path.join(projectDir, 'tiapp.xml');
	}

	if (tiapp.split(path.sep).length === 2) {
		logger.banner();
		logger.error(`Invalid project directory "${dir}"\n`);
		if (dir === '.') {
			logger.log('Use the --project-dir property to specify the project\'s directory\n');
		}
		process.exit(1);
	}

	// load the tiapp.xml
	cli.tiapp = new exports.tiappxml(path.join(projectDir, 'tiapp.xml'));
}

export function loadPlugins(logger, config, cli, projectDir, finished, silent, compact) {
	const searchPaths = {
		project: [ path.join(projectDir, 'plugins') ],
		config: [],
		global: []
	};
	let confPaths = config.get('paths.plugins');
	const defaultInstallLocation = cli.env.installPath;
	const sdkLocations = cli.env.os.sdkPaths.map(p => expand(p));

	// set our paths from the config file
	if (!Array.isArray(confPaths)) {
		confPaths = [ confPaths ];
	}
	for (let p of confPaths) {
		if (p) {
			p = expand(p);
			if (fs.existsSync(p) && !searchPaths.project.includes(p) && !searchPaths.config.includes(p)) {
				searchPaths.config.push(p);
			}
		}
	}

	// add any plugins from various sdk locations
	if (!sdkLocations.includes(defaultInstallLocation)) {
		sdkLocations.push(defaultInstallLocation);
	}
	if (cli.sdk) {
		sdkLocations.push(expand(cli.sdk.path, '..', '..', '..'));
	}
	for (let p of sdkLocations) {
		p = expand(p, 'plugins');
		if (fs.existsSync(p) && !searchPaths.project.includes(p) && !searchPaths.config.includes(p) && !searchPaths.global.includes(p)) {
			searchPaths.global.push(p);
		}
	}

	// find all hooks for active plugins
	findTiPlugins(cli.tiapp.plugins, searchPaths, config, logger, (plugins) => {
		if (plugins.missing.length) {
			if (logger) {
				logger.error('Could not find all required Titanium plugins:');
				for (const m of plugins.missing) {
					logger.error(`   id: ${m.id}\t version: ${m.version}`);
				}
				logger.log();
			}
			process.exit(1);
		}

		if (plugins.found.length) {
			for (const plugin of plugins.found) {
				cli.scanHooks(expand(plugin.pluginPath, 'hooks'));
			}
		} else {
			logger?.debug('No project level plugins to load');
		}

		if (!silent) {
			cli.emit('cli:check-plugins', { compact: compact === undefined ? true : compact });
		}

		finished();
	});
}

export function loadModuleManifest(logger, manifestFile) {
	if (!fs.existsSync(manifestFile)) {
		logger.error(`Missing ${manifestFile}`);
		logger.log();
		process.exit(1);
	}

	const re = /^(\S+)\s*:\s*(.*)$/;
	const manifest = {};
	const lines = fs.readFileSync(manifestFile).toString().split(/\r?\n/);
	for (const line of lines) {
		const match = line.match(re);
		if (match) {
			manifest[match[1].trim()] = match[2].trim();
		}
	}

	return manifest;
}

export function validateModuleManifest(logger, cli, manifest) {
	const requiredModuleKeys = [
		'name',
		'version',
		'moduleid',
		'description',
		'copyright',
		'license',
		'copyright',
		'platform',
		'minsdk',
		'architectures'
	];

	// check if all the required module keys are in the list
	for (const key of requiredModuleKeys) {
		if (!manifest[key]) {
			logger.error(`Missing required manifest key "${key}"`);
			logger.log();
			process.exit(1);
		}
	}

	if (cli.argv.platform !== exports.resolvePlatform(manifest.platform)) {
		logger.error(`Unable to find "${cli.argv.platform}" module`);
		logger.log();
		process.exit(1);
	}
}

export function validateAppJsExists(projectDir, logger, platformDirs) {
	if (!fs.existsSync(path.join(projectDir, 'Resources'))) {
		logger.error('"Resources" directory not found');
		logger.error('Ensure the "Resources" directory exists and contains an "app.js" file.\n');
		process.exit(1);
	}

	const files = [
		path.join(projectDir, 'Resources', 'app.js')
	];

	if (!Array.isArray(platformDirs)) {
		platformDirs = [ platformDirs ];
	}
	for (const platformDir of platformDirs) {
		files.push(path.join(projectDir, 'Resources', platformDir, 'app.js'));
	}

	if (!files.some(file => fs.existsSync(file))) {
		logger.error('"app.js" not found');
		logger.error('Ensure the "app.js" file exists in your project\'s "Resources" directory.\n');
		process.exit(1);
	}
}

export async function validatePlatformOptions(logger, config, cli, commandName) {
	const platform = resolvePlatform(cli.argv.platform);
	const platformCommand = path.join(path.dirname(import.meta.url), '..', '..', '..', manifest.platforms[manifest.platforms.indexOf(platform)], 'cli', 'commands', `_${commandName}.js`);
	if (fs.existsSync(platformCommand)) {
		const command = await import(platformCommand);
		return command && typeof command.validate === 'function' ? command.validate(logger, config, cli) : null;
	}
}

export function scrubPlatforms(platforms) {
	const scrubbed = {};
	const original = {};
	const bad = {};

	const platformArray = platforms.toLowerCase().split(',');
	for (const platform of platformArray) {
		const name = platformAliases[platform] || platform;
		// if name is falsey, then it's invalid anyways
		if (name) {
			if (!manifest.platforms.includes(name)) {
				bad[platform] = 1;
			} else {
				scrubbed[name] = 1;
				original[platform] = 1;
			}
		}
	}

	return {
		scrubbed: Object.keys(scrubbed).sort(), // distinct list of un-aliased platforms
		original: Object.keys(original).sort(),
		bad: Object.keys(bad).sort()
	};
}

export function resolvePlatform(platform) {
	return platformAliases[platform] || platform;
}

export function filterPlatforms(platform) {
	platform = platformAliases[platform] || platform;
	return availablePlatformsNames.filter(name => name != platform);
}

export function validatePlatform(logger, cli, name) {
	const platform = name ? cli.argv[name] : cli.argv;
	const p = cli.argv[name] = platformAliases[platform] || platform;
	if (!p || !manifest.platforms.includes(p)) {
		logger.banner();
		logger.error(`Invalid platform "${platform}"\n`);
		suggest(platform, targetPlatforms, logger.log);
		logger.log(`Available platforms for SDK version ${cli.sdk?.name || manifest.version}:`);
		for (const p of targetPlatforms) {
			logger.log(`    ${p}`);
		}
		logger.log();
		process.exit(1);
	}
}
