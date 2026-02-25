import { config } from '../config.js';
import { exists, expand, extractZip } from '../util/index.js';
import { tailgate } from '../util/tailgate.js';
import { readdir, rm } from 'fs/promises';
import { basename, dirname, join } from 'path';
import snooplogg from 'snooplogg';

const { debug, error, info } = snooplogg('ti:modules');

const platformAliases = {
	ipad: 'ios',
	iphone: 'ios',
};

type TitaniumModule = {
	id: string;
	version: string;
	platform: Set<string>;
	deployType: string;
	path: string;
};

type TitaniumModules = {
	found: TitaniumModule[];
	missing: TitaniumModule[];
	incompatible: TitaniumModule[];
	conflict: TitaniumModule[];
};

type TiappModule = {
	id: string;
	platform?: string;
	version?: string | number;
	deployType?: string;
};

export async function findTitaniumModules(options: {
	deployType?: string;
	modules: TiappModule[];
	moduleAPIVersion?: string;
	platforms?: string[];
	sdkVersion?: string;
	searchPaths?: string[];
}): Promise<TitaniumModules> {
	const result: TitaniumModules = {
		found: [],
		missing: [],
		incompatible: [],
		conflict: [],
	};

	if (!Array.isArray(options.modules) || options.modules.length === 0) {
		return result;
	}

	const modules = options.modules.map((module) => {
		const id = module.id?.trim();
		const version =
			typeof module.version === 'string' ? module.version.trim() : String(module.version);
		const deployType = module.deployType?.trim();
		const platform = new Set(
			typeof module.platform === 'string'
				? module.platform
						.split(',')
						.map((p) => {
							p = p.trim();
							return platformAliases[p] || p;
						})
						.filter(Boolean)
				: []
		);

		if (typeof id !== 'string' || id === '') {
			throw new Error(`Module ID is required`);
		}

		if (!platform.has('commonjs')) {
			platform.add('commonjs');
		}

		return {
			id: id.trim(),
			version: version?.trim(),
			platform: platform,
			deployType: deployType?.trim(),
		};
	});

	const installed = await detectTitaniumModules({
		searchPaths: options.searchPaths,
	});
	// const modulesById: Record<string, typeof modules> = {};

	for (const module of modules) {
		//
	}

	// detect conflicts
	// for (const [id, modules] of Object.entries(modulesById)) {
	// 	if (modules.length <= 1) {
	// 		continue;
	// 	}

	// 	// we have a potential conflict...
	// 	// verify that we have at least one commonjs platform and at least one non-commonjs platform

	// 	let commonJs = 0;
	// 	let nonCommonJs = 0;

	// 	for (const module of modules) {
	// 		if (module.platform.has('commonjs')) {
	// 			commonJs++;
	// 		} else {
	// 			nonCommonJs++;
	// 		}
	// 	}

	// 	if (commonJs && nonCommonJs) {
	// 		result.conflict.push({
	// 			id,
	// 			modules,
	// 		});
	// 	}
	// }

	return result;
}

/**
 * A map of module version to module platforms.
 */
type TitaniumModuleVersion = Record<string, TitaniumModule>;

/**
 * A map of platforms to
 */
type TitaniumModulesRegistry = {
	android?: Record<string, TitaniumModuleVersion>;
	commonjs?: Record<string, TitaniumModuleVersion>;
	ios?: Record<string, TitaniumModuleVersion>;
};

export async function detectTitaniumModules(
	options: { searchPaths?: string[] } = {}
): Promise<TitaniumModulesRegistry> {
	// init search paths with Titanium SDK install locations
	const titaniumInstallDir = expand(config.titanium.sdk.installPath[process.platform]);
	const configPaths = config.titanium.sdk.searchPaths[process.platform];
	const modulesPaths = new Set<string>();
	const projectPaths = new Set<string>();

	const sdkPaths = new Set<string>();
	sdkPaths.add(titaniumInstallDir);
	if (Array.isArray(configPaths)) {
		for (const path of configPaths) {
			sdkPaths.add(expand(path));
		}
	}

	// before we add the user search paths, install any modules in the Titanium SDK install locations
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
							await extractZip(zipFile, titaniumInstallDir);
							await rm(zipFile);
						} catch (err) {
							error(`Error extracting zip file: ${(err as Error).message}`);
						}
					}
				})
			);
			if (await exists(join(titaniumDir, 'modules'))) {
				modulesPaths.add(join(titaniumDir, 'modules'));
			}
		})
	);

	// add the user search paths
	if (Array.isArray(options?.searchPaths)) {
		for (let path of options.searchPaths) {
			if (typeof path === 'string' && path !== '') {
				path = expand(path);
				if (await exists(join(path, 'node_modules'))) {
					projectPaths.add(path);
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
		const modules: TitaniumModulesRegistry = {};

		await Promise.all([
			...Array.from(modulesPaths).map((path) => scanPath(path, modules)),
			...Array.from(projectPaths).map((path) => scanNodeModules(path, modules)),
		]);

		return modules;
	});
}

async function scanPath(modulesDir: string, modules: TitaniumModulesRegistry) {
	debug(`Detecting Titanium modules: ${modulesDir}`);
}

async function scanNodeModules(projectDir: string, modules: TitaniumModulesRegistry) {
	debug(`Detecting Titanium modules in node_modules: ${projectDir}`);
}
