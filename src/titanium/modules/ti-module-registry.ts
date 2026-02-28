import type { TiModuleManifest, TiModuleVersion } from './types';

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
}
