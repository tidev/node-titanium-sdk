import type { TiModule, TiModuleManifest } from './types';
import snooplogg from 'snooplogg';

const { info, log, warn } = snooplogg('ti:module-registry');

export const platformAliases = {
	ipad: 'ios',
	iphone: 'ios',
};

type TiModuleSearchResults = {
	found: TiModule[];
	missing: TiModule[];
	incompatible: TiModule[];
	conflict: TiModule[];
};

type TiappModule = {
	moduleid: string;
	platform?: string;
	version?: string | number;
	deployType?: string;
};

export class TiModuleRegistry {
	// moduleId > platform > version > module
	modules: Record<string, Record<string, Record<string, TiModule>>> = {};

	/**
	 * Registers a module from the tiapp.xml `<module>` tag.
	 * @param path - The path to the module.
	 * @param manifest - The manifest of the module.
	 */
	add(path: string, manifest: TiModuleManifest) {
		if (!this.modules[manifest.moduleid]) {
			this.modules[manifest.moduleid] = {};
		}

		if (!this.modules[manifest.moduleid][manifest.platform]) {
			this.modules[manifest.moduleid][manifest.platform] = {};
		}

		this.modules[manifest.moduleid][manifest.platform][manifest.version] = {
			...manifest,
			path,
		};
	}

	/**
	 * Search for installed Titanium modules.
	 *
	 * @param options - The options for the function.
	 * @returns Returns matching modules.
	 */
	async search(options: {
		deployType?: string;
		modules: TiappModule[];
		moduleAPIVersion?: string;
		platforms?: string | string[];
		sdkVersion?: string;
		searchPaths?: string[];
	}): Promise<TiModuleSearchResults> {
		const results: TiModuleSearchResults = {
			found: [],
			missing: [],
			incompatible: [],
			conflict: [],
		};

		const searchModules = options.modules;
		if (searchModules === undefined || !Array.isArray(searchModules)) {
			throw new Error('Expected modules to be an array');
		}
		if (searchModules.length === 0) {
			return results;
		}

		// clean up platforms
		const platformsSet = new Set<string>(
			Array.isArray(options.platforms)
				? options.platforms.map((p) => platformAliases[p.trim()] || p.trim()).filter(Boolean)
				: typeof options.platforms === 'string'
					? options.platforms
							.split(',')
							.map((p) => platformAliases[p.trim()] || p.trim())
							.filter(Boolean)
					: []
		);
		if (!platformsSet.has('commonjs')) {
			platformsSet.add('commonjs');
		}
		const searchPlatforms = Array.from(platformsSet);

		// loop through each <module> and make sure it's sane
		for (const module of searchModules) {
			const moduleid = module.moduleid?.trim();
			if (!moduleid) {
				throw new Error('Module has no module id');
			}

			// deploy type
			const deployTypes =
				module.deployType
					?.toLowerCase()
					.split(/[, ]+/)
					.map((p) => p.trim())
					.filter(Boolean) || [];
			if (options.deployType && !deployTypes.includes(options.deployType.toLowerCase())) {
				continue;
			}

			// platforms
			if (searchPlatforms.length) {
				const platforms =
					module.platform
						?.toLowerCase()
						.split(/[, ]+/)
						.map((p) => p.trim())
						.filter(Boolean) || [];
				if (!platforms.some((p) => searchPlatforms.includes(p))) {
					continue;
				}
			}

			// version
			if (module.version && module.version !== 'latest') {
				const version = typeof module.version === 'string' ? module.version.trim() : undefined;
				if (version && version !== 'latest') {
					if (version !== module.version) {
						continue;
					}
				}
			}

			console.log('Searching for:', module);

			for (const module of this.modules) {
				if (module.moduleid === moduleid) {
					results.found.push(module);
				}
			}
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

		return results;
	}
}
