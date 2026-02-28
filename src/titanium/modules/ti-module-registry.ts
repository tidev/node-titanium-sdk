import type { TiModule, TiModuleManifest, TiModuleVersion } from './types';
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
	modules: Record<string, Record<string, TiModuleVersion>> = {};

	add(path: string, manifest: TiModuleManifest) {
		if (!this.modules[manifest.platform]) {
			this.modules[manifest.platform] = {};
		}

		if (!this.modules[manifest.platform][manifest.moduleid]) {
			this.modules[manifest.platform][manifest.moduleid] = {};
		}

		this.modules[manifest.platform][manifest.moduleid][manifest.version] = {
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

		// this is flawed... we want to loop over searchModules and then loop
		// over this.modules while checking the module id, version, platform,
		// sdk versoin, deploy type, and module API version

		for (const module of searchModules) {
			const moduleid = module.moduleid?.trim();
			if (!moduleid) {
				throw new Error('Module has no module id');
			}

			// deploy type
			const deployTypes =
				module.deployType
					?.toLowerCase()
					.split(',')
					.map((p) => p.trim()) || [];
			if (options.deployType && !deployTypes.includes(options.deployType.toLowerCase())) {
				continue;
			}

			// platforms
			if (searchPlatforms.length) {
				const platforms =
					module.platform
						?.toLowerCase()
						.split(',')
						.map((p) => p.trim()) || [];
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

			console.log(module);
			// 	const version = typeof module.version === 'string' ? module.version.trim() : undefined;
			// 	const platforms = new Set<string>();
			// 	if (typeof module.platform === 'string') {
			// 		for (let p of module.platform.split(',')) {
			// 			p = p.trim();
			// 			if (p) {
			// 				platforms.add(platformAliases[p] || p);
			// 			}
			// 		}
			// 		platforms.add('commonjs');
			// 	}
			// 	log(
			// 		`Looking for moduleid="${moduleid}" version="${version || 'any'}" platforms="${Array.from(platforms).join(',') || 'any'}"`
			// 	);
			// 	log(installed);
			// 	// todo
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
