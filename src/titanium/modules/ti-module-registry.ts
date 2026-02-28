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
	 * @returns Returns matching modules.
	 */
	async search(options: {
		deployType?: string;
		modules: TiappModule[];
		moduleAPIVersion?: string;
		platforms?: string | string[];
		sdkVersion?: string;
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
		if (platformsSet.size > 0 && !platformsSet.has('commonjs')) {
			platformsSet.add('commonjs');
		}
		const searchPlatforms = Array.from(platformsSet);

		// loop through each <module> and make sure it's sane
		for (const subject of searchModules) {
			const moduleid = subject.moduleid?.trim();
			if (!moduleid) {
				throw new Error('Module has no module id');
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

			// subject.platform is comma/space separated; any matching registry platform counts
			const subjectPlatformsSet = new Set<string>(
				subject.platform
					? subject.platform
							.split(/[, ]+/)
							.map((p) => (platformAliases[p.trim()] || p.trim()).toLowerCase())
							.filter(Boolean)
					: searchPlatforms
			);
			const subjectPlatforms =
				subjectPlatformsSet.size > 0 ? Array.from(subjectPlatformsSet) : searchPlatforms;

			const wantVersion =
				subject.version !== undefined && subject.version !== ''
					? String(subject.version).trim()
					: undefined;
			const isLatest = wantVersion !== undefined && wantVersion.toLowerCase() === 'latest';
			const wantAllVersions = wantVersion === undefined;

			const byModuleId = this.modules[moduleid];
			if (!byModuleId) {
				results.missing.push(subject);
				continue;
			}

			// when `searchPlatforms` is empty, search all platforms for this module
			const platformsToSearch =
				searchPlatforms.length > 0
					? subjectPlatforms.filter((p) => searchPlatforms.includes(p))
					: subjectPlatforms.length > 0
						? subjectPlatforms
						: Object.keys(byModuleId);

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
				}
			}

			if (!foundForSubject) {
				results.missing.push(subject);
			}
		}

		return results;
	}
}
