import { config } from '../config.js';
import { exists, expand, extractZip } from '../util/index.js';
import { tailgate } from '../util/tailgate.js';
import { readdir, readFile, rm } from 'fs/promises';
import { basename, dirname, join } from 'path';
import snooplogg from 'snooplogg';

const { info, log, warn } = snooplogg('ti:modules');

export const platformAliases = {
	ipad: 'ios',
	iphone: 'ios',
};

type TitaniumModuleManifest = {
	architectures?: string[];
	apiversion?: number;
	author?: string;
	copyright?: string;
	description?: string;
	guid?: string;
	license?: string;
	minsdk?: string;
	moduleid: string;
	name?: string;
	platform: string;
	version: string;
};

type TitaniumModulePackageManifest = {
	architectures?: string | string[];
	apiversion?: number;
	author?: string;
	copyright?: string;
	description?: string;
	guid?: string;
	license?: string;
	minsdk?: string;
	moduleid: string;
	name?: string;
	platform: string | string[] | Record<string, TitaniumModuleManifest>;
	type: string;
	version: string;
};

export interface TitaniumModule {
	architectures?: string[];
	apiversion?: number;
	author?: string;
	copyright?: string;
	description?: string;
	guid?: string;
	license?: string;
	minsdk?: string;
	moduleid: string;
	name?: string;
	path: string;
	platform: string;
	version: string;
}

type TitaniumModuleVersion = Record<string, TitaniumModule>;

type TitaniumModulesRegistry = {
	android?: Record<string, TitaniumModuleVersion>;
	commonjs?: Record<string, TitaniumModuleVersion>;
	ios?: Record<string, TitaniumModuleVersion>;
};

/**
 * Detects Titanium modules in the Titanium SDK install locations and user search paths, then
 * returns a registry of found modules.
 *
 * @param options - The options for the function.
 * @param options.searchPaths - An array of paths to search for Titanium modules. Search path can be
 * a directory containing a `modules` subdirectory, an actual `modules` directory, a project
 * directory containing a `node_modules` subdirectory, or a directory within a `modules` directory.
 * @param options.skipInstall - When true, skips the installation of modules in the Titanium SDK
 * install locations.
 * @returns a registry of found modules.
 */
export async function detectTitaniumModules(
	options: {
		searchPaths?: string[];
		skipInstall?: boolean;
	} = {}
): Promise<TitaniumModulesRegistry> {
	// init search paths with Titanium SDK install locations
	const titaniumInstallDir = config.titanium.sdk.installPath[process.platform];
	const configPaths = config.titanium.sdk.searchPaths[process.platform];
	const modulesPaths = new Set<string>();
	const nodeModulesPaths = new Set<string>();

	const sdkPaths = new Set<string>();
	if (titaniumInstallDir) {
		sdkPaths.add(expand(titaniumInstallDir));
	}
	if (Array.isArray(configPaths)) {
		for (const path of configPaths) {
			sdkPaths.add(expand(path));
		}
	}

	// before we add the user search paths, install any modules in the Titanium SDK install locations
	if (!options.skipInstall) {
		await Promise.all(
			Array.from(sdkPaths).map(async (titaniumDir) => {
				if (!(await exists(titaniumDir))) {
					return;
				}
				const files = await readdir(titaniumDir);
				await Promise.all(
					files.map(async (file) => {
						if (file.endsWith('.zip')) {
							try {
								const zipFile = join(titaniumDir, file);
								info(`Installing Titanium module: ${zipFile}`);
								await extractZip(zipFile, titaniumInstallDir || titaniumDir);
								await rm(zipFile);
							} catch (err) {
								warn(`Error extracting zip file: ${(err as Error).message}`);
							}
						}
					})
				);
				if (await exists(join(titaniumDir, 'modules'))) {
					modulesPaths.add(join(titaniumDir, 'modules'));
				}
			})
		);
	}

	// add the user search paths
	if (Array.isArray(options?.searchPaths)) {
		for (let path of options.searchPaths) {
			if (typeof path === 'string' && path !== '') {
				path = expand(path);
				if (await exists(join(path, 'node_modules'))) {
					nodeModulesPaths.add(join(path, 'node_modules'));
				} else if (basename(path) === 'modules' && (await exists(path))) {
					modulesPaths.add(path);
				} else if (await exists(join(path, 'modules'))) {
					modulesPaths.add(join(path, 'modules'));
				} else {
					// we may be deep in the modules dir (like an actual module version directory)
					while (path !== dirname(path)) {
						path = dirname(path);
						if (basename(path) === 'modules' && (await exists(path))) {
							modulesPaths.add(path);
							break;
						}
					}
				}
			}
		}
	}

	return tailgate('titanium:modules:detect', async () => {
		const registry: TitaniumModulesRegistry = {};

		await Promise.all([
			...Array.from(modulesPaths).map((path) => scanPath(path, registry)),
			...Array.from(nodeModulesPaths).map((path) => scanNodeModules(path, registry)),
		]);

		return registry;
	});
}

/**
 * Scans a `modules` directory for Titanium modules.
 *
 * @param modulesDir - The path to the `modules` directory.
 * @param registry - The registry to add the found modules to.
 */
async function scanPath(modulesDir: string, registry: TitaniumModulesRegistry) {
	log(`Detecting modules in path: ${modulesDir}`);

	const platformDirs = await readdir(modulesDir);
	for (const platformName of platformDirs) {
		const moduleDirs = await readdir(join(modulesDir, platformName)).catch(() => []);
		for (const moduleName of moduleDirs) {
			const moduleDir = await readdir(join(modulesDir, platformName, moduleName)).catch(() => []);
			for (const version of moduleDir) {
				const path = join(modulesDir, platformName, moduleName, version);
				if (!(await exists(join(path, 'manifest')))) {
					continue;
				}

				try {
					const manifest = await readManifest(join(path, 'manifest'));

					if (!manifest) {
						continue;
					}

					if (!registry[manifest.platform]) {
						registry[manifest.platform] = {};
					}

					if (!registry[manifest.platform][manifest.moduleid]) {
						registry[manifest.platform][manifest.moduleid] = {};
					}

					info(`Found ${manifest.platform} module: ${manifest.moduleid}@${manifest.version}`);

					registry[manifest.platform][manifest.moduleid][manifest.version] = {
						...manifest,
						path,
					};
				} catch (err) {
					warn(`Error reading module manifest: ${(err as Error).message}`);
				}
			}
		}
	}
}

/**
 * Scans a `node_modules` directory for Titanium modules.
 *
 * @param nodeModulesDir - The path to a `node_modules` directory.
 * @param registry - The registry to add the found modules to.
 */
async function scanNodeModules(nodeModulesDir: string, registry: TitaniumModulesRegistry) {
	log(`Detecting modules in node_modules: ${nodeModulesDir}`);
	const packageDirs = await readdir(nodeModulesDir).catch(() => []);

	for (const packageName of packageDirs) {
		const packageDir = join(nodeModulesDir, packageName);
		if (packageName.startsWith('@')) {
			scanNodeModules(join(packageDir), registry);
			return;
		}

		if (!(await exists(join(packageDir, 'package.json')))) {
			continue;
		}

		log(`Scanning node package: ${packageDir}`);

		let pkgJson: Record<string, unknown>;
		try {
			const packageJsonContents = await readFile(join(packageDir, 'package.json'), 'utf8');
			pkgJson = JSON.parse(packageJsonContents);
		} catch (err) {
			warn(`Error reading package.json: ${(err as Error).message}`);
			continue;
		}

		const tiModule = pkgJson?.titanium as TitaniumModulePackageManifest;
		if (!tiModule || typeof tiModule !== 'object' || tiModule.type !== 'native-module') {
			continue;
		}

		const platformNames: string[] =
			typeof tiModule.platform === 'string'
				? [tiModule.platform]
				: Array.isArray(tiModule.platform)
					? tiModule.platform
					: typeof tiModule.platform === 'object' && tiModule.platform !== null
						? Object.keys(tiModule.platform)
						: [];

		const platformDirs: Record<string, string | null> = {};
		for (const platformName of platformNames) {
			platformDirs[platformName] =
				platformAliases[platformName] &&
				(await exists(join(packageDir, platformAliases[platformName])))
					? join(packageDir, platformAliases[platformName])
					: (await exists(join(packageDir, platformName)))
						? join(packageDir, platformName)
						: null;
		}

		if (
			platformNames.length === 1 &&
			platformDirs[platformNames[0]] === null &&
			(await exists(join(packageDir, 'manifest')))
		) {
			// the package dir is the module dir
			platformDirs[platformNames[0]] = packageDir;
		}

		const missingPlatformDirs = Object.entries(platformDirs)
			.filter(([_platform, path]) => path === null)
			.map(([platform]) => platform);
		if (Object.keys(platformDirs).length > 1 && missingPlatformDirs.length) {
			throw new Error(
				`Multiple platform native modules require use of platform-specific subdirectories: ${missingPlatformDirs.join(', ')}`
			);
		}

		for (const [platform, path] of Object.entries(platformDirs)) {
			if (!path) {
				continue;
			}

			try {
				const manifest = await readManifest(join(path, 'manifest')).catch(() => undefined);
				const architectures = Array.isArray(tiModule.architectures)
					? tiModule.architectures
					: tiModule.architectures?.split(' ') || manifest?.architectures;
				const apiversion =
					typeof tiModule.apiversion === 'number'
						? tiModule.apiversion
						: typeof tiModule.apiversion === 'string'
							? Number.parseInt(tiModule.apiversion)
							: manifest?.apiversion;
				const author =
					tiModule.author ||
					(Array.isArray(pkgJson.author) && pkgJson.author[0]) ||
					(typeof pkgJson.author === 'string' && pkgJson.author) ||
					manifest?.author;
				const copyright = tiModule.copyright || pkgJson.copyright || manifest?.copyright;
				const description = tiModule.description || pkgJson.description || manifest?.description;
				const guid = tiModule.guid || manifest?.guid;
				const license = tiModule.license || pkgJson.license || manifest?.license;
				const minsdk = tiModule.minsdk || manifest?.minsdk;
				const moduleid = tiModule.moduleid || manifest?.moduleid;
				const name =
					tiModule.name ||
					(typeof pkgJson.name === 'string' && pkgJson.name.replace(/^@[^/]+\//, '')) ||
					manifest?.name;
				const version = pkgJson.version || manifest?.version;

				info(`Found ${platform} module: ${moduleid}@${version}`);

				if (!registry[platform]) {
					registry[platform] = {};
				}

				if (!registry[platform][moduleid]) {
					registry[platform][moduleid] = {};
				}

				registry[platform][moduleid][version] = {
					architectures,
					apiversion: apiversion === undefined || isNaN(apiversion) ? undefined : apiversion,
					author,
					copyright,
					description,
					guid,
					license,
					minsdk,
					moduleid,
					name,
					path,
					platform,
					version,
				};
			} catch (err) {
				warn(`Error reading module manifest: ${(err as Error).message}`);
			}
		}
	}
}

const versionRegExp = /^(\d+\.){0,2}(\d+)$/;

/**
 * Reads a module manifest file, validates it, and returns a TitaniumModuleManifest object or
 * `undefined` if the manifest is invalid.
 * @param manifestFile path to manifest file
 * @returns TitaniumModuleManifest
 */
async function readManifest(manifestFile: string) {
	const manifest: Record<string, string> = {};
	const manifestContents = await readFile(manifestFile, 'utf8');

	for (const line of manifestContents.split(/\r?\n/)) {
		const p = line.indexOf(':');
		if (!line.startsWith('#') && p !== -1) {
			const key = line.substring(0, p).trim();
			if (key) {
				manifest[key] = line.substring(p + 1).trim();
			}
		}
	}

	if (!manifest.moduleid) {
		throw new Error(`Module manifest is missing moduleid: ${manifestFile}`);
	}

	if (!manifest.platform) {
		throw new Error(`Module manifest is missing platform: ${manifestFile}`);
	}

	if (!manifest.version) {
		throw new Error(`Module manifest is missing version: ${manifestFile}`);
	}

	if (!versionRegExp.test(manifest.version)) {
		throw new Error(`Module manifest has invalid version: ${manifest.version}`);
	}

	const platform = platformAliases[manifest.platform] || manifest.platform;

	return {
		apiversion: manifest.apiversion ? Number.parseInt(manifest.apiversion) : undefined,
		architectures: manifest.architectures ? manifest.architectures.split(' ') : undefined,
		author: manifest.author,
		copyright: manifest.copyright,
		description: manifest.description,
		guid: manifest.guid,
		license: manifest.license,
		moduleid: manifest.moduleid,
		minsdk: manifest.minsdk,
		name: manifest.name,
		platform,
		version: manifest.version,
	} as TitaniumModuleManifest;
}
