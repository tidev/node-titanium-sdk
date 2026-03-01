import * as version from '../../util/version.js';
import type { TiModule, TiModuleManifest } from './types';
import snooplogg from 'snooplogg';

const { info, log, warn } = snooplogg('ti:module-registry');

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
		const searchPlatforms = Array.from(platformsSet);

		for (const subject of tiappModules) {
			const moduleid = subject.moduleid?.trim();
			if (!moduleid) {
				// this should never happen
				throw new Error('Module has no module id');
			}

			const byModuleId = this.modules[moduleid];
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
					: searchPlatforms
			);
			const wantPlatforms = platformsSet.size > 0 ? Array.from(platformsSet) : searchPlatforms;

			const wantVersion =
				subject.version !== undefined && subject.version !== ''
					? String(subject.version).trim()
					: 'latest';
			const isLatest = wantVersion !== undefined && wantVersion.toLowerCase() === 'latest';
			const wantAllVersions = wantVersion === undefined;

			// when `searchPlatforms` is empty, search all platforms for this module
			const platformsToSearch =
				searchPlatforms.length > 0
					? wantPlatforms.filter((p) => searchPlatforms.includes(p))
					: wantPlatforms.length > 0
						? wantPlatforms
						: Object.keys(byModuleId);

			log(`${moduleid} platform=${platformsToSearch.join(',')} version=${wantVersion}`);

			let foundForSubject = false;

			for (const platform of platformsToSearch) {
				const byVersion = byModuleId[platform];
				if (!byVersion || typeof byVersion !== 'object') {
					continue;
				}

				let candidates: TiModule[];
				if (wantAllVersions) {
					const versions = Object.keys(byVersion).filter((v) => version.isValid(v));
					candidates = versions.map((v) => byVersion[v]).filter(Boolean);
				} else if (isLatest) {
					const versions = Object.keys(byVersion).filter((v) => version.isValid(v));
					if (versions.length === 0) {
						continue;
					}
					versions.sort((a, b) => version.compare(a, b));
					const candidate = byVersion[versions[versions.length - 1]];
					candidates = candidate ? [candidate] : [];
				} else {
					const candidate = byVersion[wantVersion!];
					candidates = candidate ? [candidate] : [];
				}

				for (const candidate of candidates) {
					// moduleAPIVersion and sdkVersion vs TiModule.apiversion and TiModule.minsdk
					if (options.moduleAPIVersion !== undefined && candidate.apiversion !== undefined) {
						const wantApi = Number.parseInt(String(options.moduleAPIVersion), 10);
						const modApi = Number(candidate.apiversion);
						if (!Number.isNaN(wantApi) && wantApi !== modApi) {
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
							if (version.gt(candidate.minsdk, options.sdkVersion)) {
								results.incompatible.push(candidate);
								continue;
							}
						} catch {
							results.incompatible.push(candidate);
							continue;
						}
					}

					foundForSubject = true;
					results.found.push(candidate);
					const list = foundByModuleId.get(candidate.moduleid) ?? [];
					list.push(candidate);
					foundByModuleId.set(candidate.moduleid, list);
				}
			}

			if (!foundForSubject) {
				results.missing.push(subject);
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
