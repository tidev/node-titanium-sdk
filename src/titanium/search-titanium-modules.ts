import { detectTitaniumModules, platformAliases, type TitaniumModule } from './detect-titanium-modules.js';
import snooplogg from 'snooplogg';

const { info, log, warn } = snooplogg('ti:modules');

type TitaniumModulesResults = {
	found: TitaniumModule[];
	missing: TitaniumModule[];
	incompatible: TitaniumModule[];
	conflict: TitaniumModule[];
};

type TiappModule = {
	moduleid: string;
	platform?: string;
	version?: string | number;
	deployType?: string;
};

/**
 * Search for installed Titanium modules.
 *
 * @param options - The options for the function.
 * @returns Returns matching modules.
 */
export async function searchTitaniumModules(options: {
	deployType?: string;
	modules: TiappModule[];
	moduleAPIVersion?: string;
	platforms?: string[];
	sdkVersion?: string;
	searchPaths?: string[];
}): Promise<TitaniumModulesResults> {
	const result: TitaniumModulesResults = {
		found: [],
		missing: [],
		incompatible: [],
		conflict: [],
	};

	if (!Array.isArray(options.modules) || options.modules.length === 0) {
		return result;
	}

	// clean up platforms
	const platformsSet = new Set<string>(options.platforms?.map(p => platformAliases[p.trim()] || p.trim()));
	if (!platformsSet.has('commonjs')) {
		platformsSet.add('commonjs');
	}
	options.platforms = Array.from(platformsSet);

	const installed = await detectTitaniumModules({
		searchPaths: options.searchPaths,
	});

	for (const module of options.modules) {
		const moduleid = module.moduleid?.trim();
		if (!moduleid) {
			throw new Error(`Module ID is required`);
		}

		const deployTypes = module.deployType?.split(',').map(p => p.trim());
		if (options.deployType && Array.isArray(deployTypes) && deployTypes.length > 0 && !deployTypes.includes(options.deployType)) {
			continue;
		}

		const version = typeof module.version === 'string' ? module.version.trim() : undefined;

		const platforms = new Set<string>();
		if (typeof module.platform === 'string') {
			for (let p of module.platform.split(',')) {
				p = p.trim();
				if (p) {
					platforms.add(platformAliases[p] || p);
				}
			}
			platforms.add('commonjs');
		}

		log(`Looking for moduleid="${moduleid}" version="${version || 'any'}" platforms="${Array.from(platforms).join(',') || 'any'}"`);

		log(installed);

		// todo
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
