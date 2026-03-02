import * as version from '../../util/version.js';
import type { TiModule, TiModuleManifest } from './types';
import snooplogg from 'snooplogg';

const { log } = snooplogg('ti:module-registry');

export const platformAliases = {
	ipad: 'ios',
	iphone: 'ios',
};

type TiModuleSearchResults = {
	found: TiModule[];
	missing: TiappModule[];
	incompatible: TiModule[];
	conflict: TiModule[];
};

type TiappModule = {
	moduleid: string;
	platform?: string;
	version?: string;
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
		log(
			`Adding module "${manifest.moduleid}" on platform="${manifest.platform}" version="${manifest.version}" path="${path}"`
		);

		this.modules[manifest.moduleid][manifest.platform][manifest.version] = {
			...manifest,
			path,
		};
	}

	/**
	 * Search for installed Titanium modules.
	 *
	 * @param options - The options for the function.
	 * @param options.deployType - The deploy type to search for.
	 * @param options.moduleAPIVersion - The module API version to search for.
	 * @param options.modules - The <modules> found in the `tiapp.xml`.
	 * @param options.platform - The platform(s) to search for. Generally this
	 * is either `'android'` or `['ios', 'iphone']`.
	 * @param options.sdkVersion - The SDK version to search for.
	 * @returns Returns matching modules.
	 */
	async search(options: {
		deployType?: string;
		moduleAPIVersion?: string;
		modules: TiappModule[];
		platform?: string | string[];
		sdkVersion?: string;
	}): Promise<TiModuleSearchResults> {
		const results: TiModuleSearchResults = {
			found: [],
			missing: [],
			incompatible: [],
			conflict: [],
		};
		const foundByModuleId = new Map<string, TiModule[]>();

		const tiappModules = options.modules;
		if (tiappModules === undefined || !Array.isArray(tiappModules)) {
			throw new Error('Expected modules to be an array');
		}
		if (tiappModules.length === 0) {
			return results;
		}

		// clean up platforms
		const platformsSet = new Set<string>(
			Array.isArray(options.platform)
				? options.platform
						.map((p) => (platformAliases[p.trim()] || p.trim()).toLowerCase())
						.filter(Boolean)
				: typeof options.platform === 'string'
					? options.platform
							.split(/[, ]+/)
							.map((p) => (platformAliases[p.trim()] || p.trim()).toLowerCase())
							.filter(Boolean)
					: []
		);
		if (platformsSet.size > 0 && !platformsSet.has('commonjs')) {
			platformsSet.add('commonjs');
		}
		const wantedPlatforms = Array.from(platformsSet);

		for (const subject of tiappModules) {
			const moduleid = subject.moduleid?.trim();
			if (!moduleid) {
				// this should never happen
				throw new Error('Module has no module id');
			}
			const wantedVersion =
				subject.version === undefined
					? 'latest'
					: typeof subject.version !== 'string' ||
						  !/^((\d+\.){0,2}(\d+))|latest$/i.test(subject.version.trim())
						? null
						: subject.version.trim().toLowerCase();
			if (wantedVersion === null) {
				throw new Error(`Module "${moduleid}" has invalid version "${subject.version}"`);
			}

			const byModuleId = this.modules[moduleid];
			console.log('!!', moduleid, byModuleId);
			if (!byModuleId) {
				results.missing.push(subject);
				continue;
			}

			const deployTypes =
				subject.deployType
					?.toLowerCase()
					.split(/[, ]+/)
					.map((p) => p.trim())
					.filter(Boolean) || [];
			if (options.deployType && !deployTypes.includes(options.deployType.toLowerCase())) {
				continue;
			}

			const platformsSet = new Set<string>(
				subject.platform
					? subject.platform
							.split(/[, ]+/)
							.map((p) => (platformAliases[p.trim()] || p.trim()).toLowerCase())
							.filter(Boolean)
					: wantedPlatforms
			);
			const modulePlatforms = platformsSet.size > 0 ? Array.from(platformsSet) : wantedPlatforms;

			const platformsToSearch =
				wantedPlatforms.length > 0
					? modulePlatforms.filter((p) => wantedPlatforms.includes(p))
					: modulePlatforms.length > 0
						? modulePlatforms
						: Object.keys(byModuleId);

			if (platformsToSearch.length === 0) {
				continue;
			}

			const isLatest = wantedVersion.toLowerCase() === 'latest';

			log(
				`moduleid="${moduleid}" searching="${platformsToSearch.join(',')}" version="${wantedVersion}" isLatest=${isLatest}"`
			);

			for (const platform of platformsToSearch) {
				const byVersion = byModuleId[platform];
				if (!byVersion || typeof byVersion !== 'object' || Object.keys(byVersion).length === 0) {
					log(`No versions found for "${moduleid}" on platform="${platform}"`);
					results.missing.push(subject);
					continue;
				}

				log(
					`Found "${moduleid}" on platform="${platform}" versions="${Object.keys(byVersion).join(',')}" isLatest=${isLatest} wantedVersion=${wantedVersion}`
				);
				log(byVersion);

				const ver = isLatest
					? (Object.keys(byVersion)
							.sort((a, b) => version.compare(a, b))
							.at(-1) as string)
					: wantedVersion;

				const candidate = byVersion[ver];
				log(`${moduleid} candidate="${candidate.version}" path="${candidate.path}"`);

				// moduleAPIVersion and sdkVersion vs TiModule.apiversion and TiModule.minsdk
				if (options.moduleAPIVersion !== undefined && candidate.apiversion !== undefined) {
					const wantApi = Number.parseInt(String(options.moduleAPIVersion), 10);
					const moduleApi = Number(candidate.apiversion);
					if (!Number.isNaN(wantApi) && wantApi !== moduleApi) {
						results.incompatible.push(candidate);
						continue;
					}
				}

				if (
					options.sdkVersion !== undefined &&
					candidate.minsdk !== undefined &&
					candidate.minsdk !== ''
				) {
					try {
						log(
							`${moduleid} candidate.minsdk="${candidate.minsdk}" options.sdkVersion="${options.sdkVersion}"`
						);
						if (version.gt(candidate.minsdk, options.sdkVersion)) {
							results.incompatible.push(candidate);
							continue;
						}
					} catch (err) {
						log(`${moduleid} error="${err}"`);
						// one of the versions is invalid?
						results.incompatible.push(candidate);
						continue;
					}
				}

				results.found.push(candidate);
				const list = foundByModuleId.get(candidate.moduleid) ?? [];
				list.push(candidate);
				foundByModuleId.set(candidate.moduleid, list);
			}
		}

		// detect conflicts: same moduleid with different platforms
		const conflictingModuleIds = new Set<string>();
		for (const [moduleid, mods] of foundByModuleId) {
			const platforms = new Set(mods.map((m) => m.platform));
			if (platforms.size > 1) {
				conflictingModuleIds.add(moduleid);
				results.conflict.push(...mods);
			}
		}
		results.found = results.found.filter((mod) => !conflictingModuleIds.has(mod.moduleid));

		return results;
	}
}
