import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import appc from 'node-appc';
import { tiappxml } from './tiappxml';

const version = appc.version;
export const manifest = appc.pkginfo.manifest(module);
const platformAliases = {
	// add additional aliases here for new platforms
	ipad: 'iphone',
	ios: 'iphone'
};

import * as i18n from './i18n.js';
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

export const allPlatformNames = [ 'android', 'ios', 'iphone', 'ipad' ];

export function commonOptions(logger, config) {
	return {
		'log-level': {
			abbr: 'l',
			callback(value) {
				if (Object.hasOwn(logger.levels, value)) {
					logger.setLevel(value);
				}
			},
			desc: 'minimum logging level',
			default: config.cli.logLevel || 'trace',
			hint: 'level',
			values: logger.getLevels()
		}
	};
}

export function platformOptions(logger, config, cli, commandName, finished) {
	const result = {};
	let targetPlatform = !cli.argv.help && (cli.argv.platform || cli.argv.p);

	if (!commandName) {
		finished(result);
		return;
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
	Promise.all(manifest.platforms.map(async (platform) => {
		// only configure target platform
		if (targetPlatform && platform !== targetPlatform) {
			return;
		}

		const platformDir = path.join(path.dirname(module.filename), '..', '..', '..', platform);
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
	})).then(() => finished(result));
}

export function validateProjectDir(logger, cli, argv, name) {
	const dir = argv[name] || (process.env.SOURCE_ROOT ? path.join(process.env.SOURCE_ROOT, '..', '..') : '.');
	let projectDir = argv[name] = path.resolve(dir);

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
			logger.log(`Use the ${'--project-dir'.cyan} property to specify the project's directory\n`);
		}
		process.exit(1);
	}

	// load the tiapp.xml
	cli.tiapp = new exports.tiappxml(path.join(projectDir, 'tiapp.xml'));
};

export function validateTiappXml(logger, config, tiapp) {
	if (!tiapp.id) {
		logger.error('tiapp.xml is missing the <id> element');
		logger.error('The app id must consist of letters, numbers, and underscores.');
		logger.error('Note: Android does not allow dashes and iOS does not allow underscores.');
		logger.error('The first character must be a letter or underscore.');
		logger.error('Usually the app id is your company\'s reversed Internet domain name. (i.e. com.example.myapp)\n');
		process.exit(1);
	}

	if (!tiapp.name) {
		logger.error('tiapp.xml is missing the <name> element');
		logger.error('The project name must consist of letters, numbers, dashes, and underscores.');
		logger.error('The first character must be a letter.\n');
		process.exit(1);
	}

	if (!tiapp.guid) {
		logger.error('tiapp.xml is missing the <guid> element');
		logger.error('The guid must be in the format XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX and consist of letters and numbers.\n');
		logger.log('If you need a new guid, below are 5 freshly generated new ones that you can choose from:');
		for (let i = 0; i < 5; i++) {
			logger.log('    ' + uuid.v4().cyan);
		}
		logger.log();
		process.exit(1);
	}

	if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(tiapp.guid)) {
		logger.error(`tiapp.xml contains an invalid guid "${tiapp.guid}"`);
		logger.error('The guid must be in the format XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX and consist of letters and numbers.\n');
		logger.log('If you need a new guid, below are 5 freshly generated new ones that you can choose from:');
		for (let i = 0; i < 5; i++) {
			logger.log('    ' + uuid.v4().cyan);
		}
		logger.log();
		process.exit(1);
	}

	if (!tiapp.version) {
		tiapp.version = '1.0';
	}

	if (!config.get('app.skipVersionValidation') && !tiapp.properties['ti.skipVersionValidation']) {
		if (!/^\d+(\.\d+(\.\d+(\..+)?)?)?$/.test(tiapp.version)) {
			logger.error(`tiapp.xml contains an invalid version "${tiapp.version}"`);
			logger.error('The version must consist of three positive integers in the format "X.Y.Z".\n');
			process.exit(1);
		}

		if (('' + tiapp.version).charAt(0) == '0') { // eslint-disable-line eqeqeq
			logger.warn(`tiapp.xml contains an invalid version "${tiapp.version}"`);
			logger.warn('The app version major number must be greater than zero.');
		}
	}
}

export function validAppId(id) {
	const words = {
		abstract: 1,
		assert: 1,
		boolean: 1,
		break: 1,
		byte: 1,
		case: 1,
		catch: 1,
		char: 1,
		class: 1,
		const: 1,
		continue: 1,
		default: 1,
		do: 1,
		double: 1,
		else: 1,
		enum: 1,
		extends: 1,
		false: 1,
		final: 1,
		finally: 1,
		float: 1,
		for: 1,
		goto: 1,
		if: 1,
		implements: 1,
		import: 1,
		instanceof: 1,
		int: 1,
		interface: 1,
		long: 1,
		native: 1,
		new: 1,
		null: 1,
		package: 1,
		private: 1,
		protected: 1,
		public: 1,
		return: 1,
		short: 1,
		static: 1,
		strictfp: 1,
		super: 1,
		switch: 1,
		synchronized: 1,
		this: 1,
		throw: 1,
		throws: 1,
		transient: 1,
		true: 1,
		try: 1,
		void: 1,
		volatile: 1,
		while: 1
	};
	const parts = id.split('.');
	const l = parts.length;

	for (let i = 0; i < l; i++) {
		if (words[parts[i]]) {
			return false;
		}
	}

	return true;
};

export function loadPlugins(logger, config, cli, projectDir, finished, silent, compact) {
	const searchPaths = {
		project: [ path.join(projectDir, 'plugins') ],
		config: [],
		global: []
	};
	let confPaths = config.get('paths.plugins');
	const defaultInstallLocation = cli.env.installPath;
	const sdkLocations = cli.env.os.sdkPaths.map(p => path.resolve(p));

	// set our paths from the config file
	if (!Array.isArray(confPaths)) {
		confPaths = [ confPaths ];
	}
	for (let p of confPaths) {
		if (p) {
			p = path.resolve(p);
			if (fs.existsSync(p) && searchPaths.project.indexOf(p) === -1 && searchPaths.config.indexOf(p) === -1) {
				searchPaths.config.push(p);
			}
		}
	}

	// add any plugins from various sdk locations
	if (sdkLocations.indexOf(defaultInstallLocation) === -1) {
		sdkLocations.push(defaultInstallLocation);
	}
	if (cli.sdk) {
		sdkLocations.push(path.resolve(cli.sdk.path, '..', '..', '..'));
	}
	for (let p of sdkLocations) {
		p = path.resolve(p, 'plugins');
		if (fs.existsSync(p) && searchPaths.project.indexOf(p) === -1 && searchPaths.config.indexOf(p) === -1 && searchPaths.global.indexOf(p) === -1) {
			searchPaths.global.push(p);
		}
	}

	// find all hooks for active plugins
	appc.tiplugin.find(cli.tiapp.plugins, searchPaths, config, logger, (plugins) => {
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
				cli.scanHooks(path.resolve(plugin.pluginPath, 'hooks'));
			}
		} else {
			logger?.debug('No project level plugins to load');
		}

		if (!silent) {
			cli.emit('cli:check-plugins', { compact: compact === undefined ? true : compact });
		}

		finished();
	});
};

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

export function validateCorrectSDK(logger, config, cli, commandName) {
	// tiapp.xml should exist by the time we get here
	const { argv, tiapp } = cli;
	let sdkName = tiapp['sdk-version'];
	const selectedSdk = cli.sdk?.name || manifest.version;

	if (!sdkName) {
		sdkName = tiapp['sdk-version'] = cli.sdk?.name || Object.keys(cli.env.sdks).sort().pop();
	}

	if (argv.legacy !== true && (!sdkName || sdkName === selectedSdk)) {
		return true;
	}

	// check the project's preferred sdk is even installed
	if (sdkName === '__global__' || !cli.env.sdks[sdkName]) {
		logger.banner();
		logger.error('Unable to compile project because the \'sdk-version\' in the tiapp.xml is not installed\n');
		logger.log(`The project's ${'sdk-version'.cyan} is currently set to ${sdkName.cyan}, which is not installed.\n`);
		logger.log(`Update the ${'sdk-version'.cyan} in the tiapp.xml to one of the installed Titaniums SDKs:`);
		const sortedSdks = Object.keys(cli.env.sdks).sort();
		for (const ver of sortedSdks) {
			if (ver !== '__global__') {
				logger.log('    ' + ver.cyan);
			}
		}
		logger.log(`or run '${('titanium sdk install ' + sdkName).cyan}' to download and install Titanium SDK ${sdkName}\n`);
		process.exit(1);
	}

	// fork or die
	if (config.cli.failOnWrongSDK) {
		logger.banner();
		logger.error(`Unable to compile a ${sdkName} project with Titanium SDK ${selectedSdk}`);
		logger.error(`To build this application, set the <sdk-version> in the tiapp.xml to the current Titaniums SDK: ${selectedSdk}\n`);
		process.exit(1);
	}

	const args = argv.$_;
	const p = args.indexOf('--sdk');
	const platform = exports.resolvePlatform(argv.platform);
	const cmd = [];
	const cmdSafe = [];
	let cmdRoot;
	let hideBanner = false;
	let delayCmd = false;

	function cmdAdd(...args) {
		for (let i = 0; i < args.length; i++) {
			cmd.push(arguments[i]);
			cmdSafe.push(arguments[i]);
		}
	}

	function cmdAddSecret(_param) {
		for (let i = 0; i < arguments.length; i++) {
			cmd.push(arguments[i]);
			cmdSafe.push('*******');
		}
	}

	if (p !== -1) {
		args.splice(p, 2);
	}

	if (!argv.legacy) {
		logger.info(`tiapp.xml <sdk-version> set to ${sdkName.cyan}, but current Titanium SDK set to ${selectedSdk.cyan}`);
	}

	const sdkVersion = cli.env.sdks[sdkName].manifest && cli.env.sdks[sdkName].manifest.version || sdkName;

	if (argv.legacy || version.lt(sdkVersion, '2.2.0')) { // technically, there is no 2.2, it was released as 3.0
		// in 3.2, we renamed --password to --store-password as to not conflict with the
		// authentication --password option
		if (argv.platform === 'android' && argv['store-password']) {
			argv.password = argv['store-password'];
		}

		cmdRoot = 'python';

		const builderPy = path.join(path.resolve(cli.env.sdks[sdkName].path), platform, 'builder.py');
		cmdAdd(builderPy);

		switch (platform) {
			case 'iphone':
				switch (argv.target) {
					case 'simulator':
						if (argv['build-only']) {
							cmdAdd('build', argv['ios-version'], argv['project-dir'], tiapp.id, tiapp.name, argv['device-family'], argv['sim-type'], argv['debug-host']);
						} else {
							cmdAdd('run', argv['project-dir'], argv['ios-version'], '', '', argv['device-family'], argv['sim-type'], argv['debug-host']);
						}
						break;

					case 'device':
						cmdAdd('install', argv['ios-version'], argv['project-dir'], tiapp.id, tiapp.name, argv['pp-uuid'], argv['developer-name'], argv['device-family'], argv.keychain, argv['debug-host']);
						break;

					case 'dist-appstore':
						cmdAdd('distribute', argv['ios-version'], argv['project-dir'], tiapp.id, tiapp.name, argv['pp-uuid'], argv['distribution-name'], '.', argv['device-family'], argv.keychain);
						break;

					case 'dist-adhoc':
						cmdAdd('adhoc', argv['ios-version'], argv['project-dir'], tiapp.id, tiapp.name, argv['pp-uuid'], argv['distribution-name'], argv['device-family'], argv.keychain, argv['debug-host']);
						break;
				}
				break;

			case 'android':
				if (argv['build-only']) {
					cmdAdd('build', tiapp.name, argv['android-sdk'], argv['project-dir'], tiapp.id);
				} else {
					if (argv.target === 'emulator') {
						if (!argv['avd-id']) {
							logger.error(`Missing required option "${'--avd-id'}"\n`);
							process.exit(1);
						}
						if (!argv['avd-skin']) {
							logger.error(`Missing required option "${'--avd-skin'}"\n`);
							process.exit(1);
						}
					}

					switch (argv.target) {
						case 'emulator':
							cmdAdd('simulator', tiapp.name, argv['android-sdk'], argv['project-dir'], tiapp.id, argv['avd-id'], argv['avd-skin']);
							delayCmd = true;

							// launch the emulator
							const emuArgs = [ builderPy, 'emulator', tiapp.name, argv['android-sdk'], argv['project-dir'], tiapp.id, argv['avd-id'], argv['avd-skin'] ];
							if (argv['avd-abi']) {
								emuArgs.push(argv['avd-abi']);
							}
							logger.info(`Launching Android emulator: ${('"' + cmdRoot + '" "' +  emuArgs.join('" "') + '"').cyan}`);
							spawn(cmdRoot, emuArgs, {
								detached: true,
								stdio: 'ignore'
							}).on('exit', function (code, signal) {
								console.log('EMULATOR EXITED', code, signal);
							});
							break;

						case 'device':
							cmdAdd('install', tiapp.name, argv['android-sdk'], argv['project-dir'], tiapp.id, 1);
							break;

						case 'dist-playstore':
							cmdAdd('distribute', tiapp.name, argv['android-sdk'], argv['project-dir'], tiapp.id, argv['keystore']);
							cmdAddSecret(argv['password']);
							cmdAdd(argv['alias'], argv['output-dir']);
							break;
					}
				}

				// Add debug host if it's defined
				if (argv['debug-host']) {
					if (argv.target === 'device') {
						cmdAdd('');
					}
					cmdAdd(argv['debug-host']);
				}
				// Add profiler host if it's defined
				if (argv['profiler-host']) {
					if (argv.target === 'device') {
						cmdAdd('');
					}
					cmdAdd(argv['profiler-host']);
					cmdAdd('profiler');
				}
		}

	} else {

		// 3.0.0's iOS build does not like it if node has a full path, so we hope they have node in the path
		cmdRoot = version.gte(sdkVersion, '3.0.2') ? (process.execPath || 'node') : 'node';

		hideBanner = true;

		// If the titanium path has spaces, then we are trying to combine the paths and verify after they were split.
		const titaniumPath = (function getTitaniumPath(params) {
			const paramsArray = params.split(' ');
			let pathSegment;
			let prevPath = '';
			while ((pathSegment = paramsArray.pop())) {
				if (fs.existsSync(pathSegment + prevPath)) {
					return pathSegment + prevPath;
				}
				prevPath = ' ' + pathSegment;
			}
			// fallback to default last segment, if we fail for any reason.
			return params.split(' ').pop();
		}(argv.$0));

		cmdAdd(titaniumPath);
		cmdAdd(commandName, '--sdk', sdkName);

		const flags = {};
		const options = {};

		// mix the command and platform specific options together
		for (const ctx of [ cli.globalContext, cli.command, cli.command.platform ]) {
			if (ctx && ctx.conf) {
				if (ctx.conf.flags) {
					Object.assign(flags, ctx.conf.flags);
				}
				if (ctx.conf.options) {
					Object.assign(options, ctx.conf.options);
				}
			}
		}

		for (const name of Object.keys(flags)) {
			const def = Object.prototype.hasOwnProperty.call(flags[name], 'default') ? flags[name].default : false;
			if (argv[name] !== undefined && def !== argv[name]) {
				cmdAdd(`--${(argv[name] ? '' : 'no-')}${name}`);
			}
		}

		for (const name of Object.keys(options)) {
			if (name !== 'sdk' && argv[name] !== undefined) {
				// in 3.2, we renamed --password to --store-password as to not conflict with the
				// authentication --password option
				let arg = name;
				if (argv.platform === 'android' && arg === 'store-password' && version.lt(sdkVersion, '3.2.0')) {
					arg = 'password';
				}

				cmdAdd(`--${arg}`);
				if (options[name].secret) {
					cmdAddSecret(argv[name]);
				} else {
					cmdAdd(argv[name]);
				}
			}
		}
	}

	// trim off the empty trailing args
	while (!cmd[cmd.length - 1]) {
		cmd.pop();
		cmdSafe.pop();
	}

	if (argv.legacy) {
		logger.info(`Forking legacy SDK command: ${(cmdRoot + ' "' +  cmdSafe.join('" "') + '"').cyan}\n`);
	} else {
		logger.info(`Forking correct SDK command: ${('"' + cmdRoot + '" "' +  cmdSafe.join('" "') + '"').cyan}\n`);
	}

	if (hideBanner) {
		cmd.push('--no-banner');
	}

	// when doing a legacy Android build (1.X or 2.X), then we delay the build to
	// allow the emulator to start because there is a bug where the builder.py
	// doesn't like to be run concurrently
	setTimeout(() => {
		spawn(cmdRoot, cmd, {
			stdio: 'inherit'
		}).on('close', (code, _signal) => {
			if (code) {
				process.exit(code);
			}
		});
	}, delayCmd ? 1000 : 0);
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

export function validatePlatformOptions(logger, config, cli, commandName) {
	const platform = resolvePlatform(cli.argv.platform),
		platformCommand = path.join(path.dirname(import.meta.url), '..', '..', '..', manifest.platforms[manifest.platforms.indexOf(platform)], 'cli', 'commands', `_${commandName}.js`);
	if (fs.existsSync(platformCommand)) {
		const command = require(platformCommand);
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
			if (manifest.platforms.indexOf(name) === -1) {
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
	if (!p || manifest.platforms.indexOf(p) === -1) {
		logger.banner();
		logger.error(`Invalid platform "${platform}"\n`);
		appc.string.suggest(platform, targetPlatforms, logger.log);
		logger.log(`Available platforms for SDK version ${cli.sdk?.name || manifest.version}:`);
		for (const p of targetPlatforms) {
			logger.log(`    ${p.cyan}`);
		}
		logger.log();
		process.exit(1);
	}
}
