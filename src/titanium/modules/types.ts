export type TiModuleManifest = {
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

export type TiModulePackageManifest = {
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
	platform: string | string[] | Record<string, TiModuleManifest>;
	type: string;
	version: string;
};

export interface TiModule {
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

export type TiModuleVersion = Record<string, TiModule>;
