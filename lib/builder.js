import fs from 'node:fs';
import path from 'node:path';
import appc from 'node-appc';
import crypto from 'node:crypto';
import ti from './titanium.js';

/**
 * The base class for platform specific build commands. This ensures some
 * commonality between build commands so that hooks can consistently
 * access build properties.
 *
 * General usage is to extend the Builder class and override the config(),
 * validate(), and run() methods:
 *
 * @example
 * import { Builder } from 'node-titanium-sdk';
 *
 * class SomePlatformBuilder extends Builder {
 *     config(logger, config, cli) {
 *         super.config(logger, config, cli);
 *         // TODO: platform specific config code goes here
 *     }
 *
 *     validate(logger, config, cli) {
 *         super.validate(logger, config, cli);
 *         // TODO: platform specific validate code goes here
 *     }
 *
 *     run(logger, config, cli, finished) {
 *         super.run();
 *         // TODO: platform specific run code goes here
 *         finished();
 *     }
 * }
 */
export class Builder {
	/**
	 * Constructs the build state. This needs to be explicitly called from the
	 * derived builder's constructor.
	 *
	 * @param {Module} buildModule The "module" variable from the build command file
	 */
	constructor(buildModule) {
		//
	}

	this.titaniumSdkPath = (function scan(dir) {
		const file = path.join(dir, 'manifest.json');
		if (fs.existsSync(file)) {
			return dir;
		}
		dir = path.dirname(dir);
		return dir !== '/' && scan(dir);
	}(__dirname));

	this.titaniumSdkName = path.basename(this.titaniumSdkPath);

	this.titaniumSdkVersion = ti.manifest.version;

	this.platformPath = (function scan(dir) {
		const file = path.join(dir, 'package.json');
		if (fs.existsSync(file)) {
			return dir;
		}
		dir = path.dirname(dir);
		return dir !== '/' && scan(dir);
	}(path.dirname(buildModule.filename)));

	this.platformName = path.basename(this.platformPath);

	this.globalModulesPath = path.join(this.titaniumSdkPath, '..', '..', '..', 'modules');

	this.packageJson = require(path.join(this.platformPath, 'package.json'));

	this.conf = {};

	this.buildDirFiles = {};
}

/**
 * Defines common variables prior to running the build's config(). This super
 * function should be called prior to the platform-specific build command's config().
 *
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config
 * @param {Object} cli - The CLI instance
 */
Builder.prototype.config = function config(logger, config, cli) {
	// note: this function must be sync!
	this.logger = logger;
	this.config = config;
	this.cli = cli;
	this.symlinkFilesOnCopy = false;
	this.ignoreDirs = new RegExp(config.get('cli.ignoreDirs'));
	this.ignoreFiles = new RegExp(config.get('cli.ignoreFiles'));
};

/**
 * Validation stub function. Meant to be overwritten.
 *
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config
 * @param {Object} cli - The CLI instance
 */
Builder.prototype.validate = function validate(logger, config, cli) {
	// note: this function must be sync!

	this.tiapp = cli.tiapp;
	this.timodule = cli.timodule;
	this.projectDir = cli.argv['project-dir'];
	this.buildDir = path.join(this.projectDir, 'build', this.platformName);

	this.defaultIcons = [
		path.join(this.projectDir, 'DefaultIcon-' + this.platformName + '.png'),
		path.join(this.projectDir, 'DefaultIcon.png')
	];
};

/**
 * Defines common variables prior to running the build. This super function
 * should be called prior to the platform-specific build command's run().
 *
 * @param {Object} _logger - The logger instance
 * @param {Object} _config - The CLI config
 * @param {Object} _cli - The CLI instance
 * @param {Function} _finished - A function to call after the function finishes
 */
Builder.prototype.run = function run(_logger, _config, _cli, _finished) {
	// note: this function must be sync!

	var buildDirFiles = this.buildDirFiles = {};

	// walk the entire build dir and build a map of all files
	if (fs.existsSync(this.buildDir)) {
		this.logger.trace('Snapshotting build directory');
		(function walk(dir) {
			fs.readdirSync(dir).forEach(function (name) {
				var file = path.join(dir, name).normalize();
				try {
					var stat = fs.lstatSync(file);
					if (stat.isDirectory()) {
						walk(file);
					} else {
						buildDirFiles[file] = stat;
					}
				} catch (ex) {
					buildDirFiles[file] = true;
				}
			});
		}(this.buildDir));
	}
};

/**
 * Removes a file from the buildDirFiles map.
 *
 * @param {String} file - The file to unmark.
 */
Builder.prototype.unmarkBuildDirFile = function unmarkBuildDirFile(file) {
	delete this.buildDirFiles[file.normalize()];
};

/**
 * Removes all paths from the buildDirFiles map that start with the specified path.
 *
 * @param {String} dir - The path prefix to unmark files.
 */
Builder.prototype.unmarkBuildDirFiles = function unmarkBuildDirFiles(dir) {
	if (/\*$/.test(dir)) {
		dir = dir.substring(0, dir.length - 1);
	} else if (!/\/$/.test(dir)) {
		dir += '/';
	}
	dir = dir.normalize();
	Object.keys(this.buildDirFiles).forEach(function (file) {
		if (file.indexOf(dir) === 0) {
			delete this.buildDirFiles[file];
		}
	}, this);
};

/**
 * Copies or symlinks a file to the specified destination.
 *
 * @param {String} src - The file to copy.
 * @param {String} dest - The destination of the file.
 * @param {Object} [opts] - An object containing various options.
 * @param {Boolean} [opts.forceCopy] - When true, forces the file to be copied and not symlinked.
 * @param {Boolean} [opts.forceSymlink] - When true, ignores `opts.contents` and `opts.forceCopy` and symlinks the `src` to the `dest`.
 * @param {Buffer|String} [opts.contents] - The contents to write to the file instead of reading the specified source file.
 */
Builder.prototype.copyFileSync = function copyFileSync(src, dest, opts) {
	var parent = path.dirname(dest),
		exists = fs.existsSync(dest);

	opts && typeof opts === 'object' || (opts = {});

	fs.ensureDirSync(parent);

	if (!opts.forceSymlink && (opts.forceCopy || !this.symlinkFilesOnCopy || opts.contents)) {
		if (exists) {
			this.logger.debug(`Overwriting ${src.cyan} => ${dest.cyan}`);
			fs.unlinkSync(dest);
		} else {
			this.logger.debug(`Copying ${src.cyan} => ${dest.cyan}`);
		}
		fs.writeFileSync(dest, opts.contents || fs.readFileSync(src));
		return true;

	} else if (!exists || (fs.lstatSync(dest).isSymbolicLink() && fs.realpathSync(dest) !== src)) {
		exists && fs.unlinkSync(dest);
		this.logger.debug(`Symlinking ${src.cyan} => ${dest.cyan}`);
		fs.symlinkSync(src, dest);
		return true;
	}
};

/**
 * Copies or symlinks a file to the specified destination.
 *
 * @param {String} src - The directory to copy.
 * @param {String} dest - The destination of the files.
 * @param {Object} [opts] - An object containing various options.
 * @param {RegExp} [opts.rootIgnoreDirs] - A regular expression of directories to ignore only in the root directory.
 * @param {RegExp} [opts.ignoreDirs] - A regular expression of directories to ignore.
 * @param {RegExp} [opts.ignoreFiles] - A regular expression of files to ignore.
 * @param {Function} [opts.beforeCopy] - A function called before copying the file. This function can abort the copy or modify the contents being copied.
 * @param {Boolean} [opts.forceCopy] - When true, forces the file to be copied and not symlinked.
 * @param {Function} [opts.afterCopy] - A function called with the result of the file being copied.
 */
Builder.prototype.copyDirSync = function copyDirSync(src, dest, opts) {
	if (!fs.existsSync(src)) {
		return;
	}

	opts && typeof opts === 'object' || (opts = {});

	(function copy(src, dest, isRootDir) {
		fs.ensureDirSync(dest);

		fs.readdirSync(src).forEach(function (name) {
			const srcFile = path.join(src, name);
			const destFile = path.join(dest, name);

			// skip broken symlinks
			if (!fs.existsSync(srcFile)) {
				return;
			}

			const srcStat = fs.statSync(srcFile);
			if (srcStat.isDirectory()) {
				// we are copying a subdirectory
				if ((isRootDir && opts.rootIgnoreDirs && opts.rootIgnoreDirs.test(name)) || (opts.ignoreDirs && opts.ignoreDirs.test(name))) {
					// ignoring directory
				} else {
					copy.call(this, srcFile, destFile);
				}
				return;
			}

			// we're copying a file, check if we should ignore it
			if (opts.ignoreFiles && opts.ignoreFiles.test(name)) {
				return;
			}

			if (typeof opts.beforeCopy === 'function') {
				const result = opts.beforeCopy(srcFile, destFile, srcStat);
				if (result === null) {
					return; // skip
				} else if (result !== undefined) {
					this.logger.debug(`Writing ${srcFile.cyan} => ${destFile.cyan}`);
					fs.writeFileSync(destFile, result);
					return;
				}
				// fall through and copy the file normally
			}

			const result = this.copyFileSync(srcFile, destFile, opts);
			if (typeof opts.afterCopy === 'function') {
				opts.afterCopy(srcFile, destFile, srcStat, result);
			}
		}, this);
	}).call(this, src, dest, true);
};

/**
 * Validates that all required Titanium Modules defined in the tiapp.xml are
 * installed.
 *
 * This function is intended to be called asynchronously from the validate()
 * implementation. In other words, validate() should return a function that
 * calls this function.
 *
 * Note: This function will forcefully exit the application on error!
 *
 * @example
 *     SomePlatformBuilder.prototype.validate = function validate(logger, config, cli) {
 *         Builder.prototype.validate.apply(this, arguments);
 *
 *         // TODO: synchronous platform specific validation code goes here
 *
 *         return function (callback) {
 *             // TODO: asynchronous platform specific validation code goes here
 *
 *             this.validateTiModules(callback);
 *         }.bind(this);
 *     };
 *
 * @param {String|Array} platformName - One or more platform names to use when finding Titanium modules
 * @param {String} deployType - The deployment type (development, test, production)
 * @param {Function} callback(err) - A function to call after the function finishes
 */
Builder.prototype.validateTiModules = function validateTiModules(platformName, deployType, callback) {
	var moduleSearchPaths = [ this.projectDir ],
		customSDKPaths = this.config.get('paths.sdks'),
		customModulePaths = this.config.get('paths.modules');

	function addSearchPath(p) {
		p = appc.fs.resolvePath(p);
		if (fs.existsSync(p) && moduleSearchPaths.indexOf(p) === -1) {
			moduleSearchPaths.push(p);
		}
	}

	this.cli.env.os.sdkPaths.forEach(addSearchPath);
	Array.isArray(customSDKPaths) && customSDKPaths.forEach(addSearchPath);
	Array.isArray(customModulePaths) && customModulePaths.forEach(addSearchPath);

	appc.timodule.find(this.cli.tiapp.modules, platformName, deployType, ti.manifest, moduleSearchPaths, this.logger, function (modules) {
		if (modules.missing.length) {
			this.logger.error('Could not find all required Titanium Modules:');
			modules.missing.forEach(function (m) {
				this.logger.error('   id: ' + m.id + '\t version: ' + (m.version || 'latest') + '\t platform: ' + m.platform + '\t deploy-type: ' + m.deployType);
			}, this);
			this.logger.log();
			process.exit(1);
		}

		if (modules.incompatible.length) {
			this.logger.error('Found incompatible Titanium Modules:');
			modules.incompatible.forEach(function (m) {
				this.logger.error('   id: ' + m.id + '\t version: ' + (m.version || 'latest') + '\t platform: ' + m.platform + '\t min sdk: ' + (m.manifest && m.manifest.minsdk || '?'));
			}, this);
			this.logger.log();
			process.exit(1);
		}

		if (modules.conflict.length) {
			this.logger.error('Found conflicting Titanium modules:');
			modules.conflict.forEach(function (m) {
				this.logger.error(`   Titanium module "${m.id}" requested for both Android and CommonJS platforms, but only one may be used at a time.`);
			}, this);
			this.logger.log();
			process.exit(1);
		}

		callback(null, modules);
	}.bind(this)); // end timodule.find()
};

/**
 * Returns the hexadecimal md5 hash of a string.
 *
 * @param {String} str - The string to hash
 *
 * @returns {String}
 */
Builder.prototype.hash = function hash(str) {
	return crypto.createHash('md5').update(str || '').digest('hex');
};

/**
 * Generates missing app icons based on the DefaultIcon.png.
 *
 * @param {Array<Object>} icons - An array of objects describing the icon size to generate and the destination
 * @param {Function} callback - A function to call after the icons have been generated
 */
Builder.prototype.generateAppIcons = function generateAppIcons(icons, callback) {
	const requiredMissing = icons.filter(icon => icon.required).length;
	let size = null;
	var fail = function () {
		this.logger.error('Unable to create missing icons:');
		printMissing(this.logger.error);
		callback(true);
	}.bind(this);

	function printMissing(logger, all) {
		for (const icon of icons) {
			if (all || size === null || icon.width > size.width) {
				logger(`  ${icon.description} - size: ${icon.width}x${icon.height}`);
			}
		}
	}

	let iconLabels;
	if (this.defaultIcons.length > 2) {
		const labels = this.defaultIcons.map(icon => '"' + path.basename(icon) + '"');
		const last = labels.pop();
		iconLabels = labels.join(', ') + ', or ' + last;
	} else {
		iconLabels = this.defaultIcons.map(icon => '"' + path.basename(icon) + '"').join(' or ');
	}

	const defaultIcon = this.defaultIcons.find(icon => fs.existsSync(icon));

	if (!defaultIcon) {
		if (requiredMissing === 0) {
			this.logger.warn(__n('There is a missing app icon, but it is not required', 'There are missing app icons, but they are not required', icons.length));
			this.logger.warn(__('You can either create the missing icons below or create an image named %s in the root of your project', iconLabels));
			this.logger.warn(__('If the DefaultIcon.png image is present, the build will use it to generate all missing icons'));
			this.logger.warn(__('It is highly recommended that the DefaultIcon.png be 1024x1024'));
			printMissing(this.logger.warn);
			return callback();
		}

		this.logger.error(__n('There is a missing required app icon', 'There are missing required app icons', icons.length));
		this.logger.error(__('You must either create the missing icons below or create an image named %s in the root of your project', iconLabels));
		this.logger.error(__('If the DefaultIcon.png image is present, the build will use it to generate all missing icons'));
		this.logger.error(__('It is highly recommended that the DefaultIcon.png be 1024x1024'));
		return fail();
	}

	const contents = fs.readFileSync(defaultIcon);
	size = appc.image.pngInfo(contents);

	if (size.width !== size.height) {
		this.logger.error(__('The %s is %sx%s, however the width and height must be equal', defaultIcon, size.width, size.height));
		this.logger.error(__('It is highly recommended that the %s be 1024x1024', defaultIcon));
		return fail();
	}

	this.logger.debug(__('Found %s (%sx%s)', defaultIcon.cyan, size.width, size.height));
	this.logger.info(__n(
		'Missing %s app icon, generating missing icon',
		'Missing %s app icons, generating missing icons',
		icons.length
	));
	printMissing(this.logger.info, true);

	const rename = [];
	let minRequiredSize = null;
	let minSize = null;
	for (let i = 0; i < icons.length; i++) {
		const icon = icons[i];
		if (icon.required) {
			if (minRequiredSize === null || icon.width > minRequiredSize) {
				minRequiredSize = icon.width;
			}
		} else if (icon.width > size.width) {
			// default icon isn't big enough, so we just skip this image
			this.logger.warn(__('%s (%sx%s) is not large enough to generate missing icon "%s" (%sx%s), skipping', defaultIcon, size.width, size.height, path.basename(icon.file), icon.width, icon.height));
			icons.splice(i--, 1);
			continue;
		}
		if (minSize === null || icon.width > minSize) {
			minSize = icon.width;
		}
		if (!path.extname(icon.file)) {
			// the file doesn't have an extension, so we need to temporarily set
			// one so that the image resizer doesn't blow up
			rename.push({
				from: icon.file + '.png',
				to: icon.file
			});
			icon.file += '.png';
		}
	}

	if (minRequiredSize !== null && size.width < minRequiredSize) {
		this.logger.error(__('The %s must be at least %sx%s', defaultIcon, minRequiredSize, minRequiredSize));
		this.logger.error(__('It is highly recommended that the %s be 1024x1024', defaultIcon));
		return fail();
	}

	appc.image.resize(defaultIcon, icons, function (error, _stdout, _stderr) {
		if (error) {
			this.logger.error(error);
			this.logger.log();
			process.exit(1);
		}

		rename.forEach(function (file) {
			fs.renameSync(file.from, file.to);
		});

		callback();
	}.bind(this), this.logger);
};
