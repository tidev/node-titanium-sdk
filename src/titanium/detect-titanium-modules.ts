import { basename } from 'path';
import { tailgate } from '../util/tailgate.js';
import { expand } from '../util/index.js';
import { config } from '../config.js';

type TitaniumModuleOptions = {
	name: string;
	path: string;
};

class TitaniumModule {
	name!: string;
	path!: string;

	private constructor(options: TitaniumModuleOptions) {
		Object.assign(this, options);
	}

	static async load(path: string): Promise<TitaniumModule> {
		return new TitaniumModule({
			name: basename(path),
			path,
		});
	}
};

export async function detectTitaniumModules(
	options: { searchPaths?: string[] } = {}
): Promise<TitaniumModule[]> {
	const searchPaths = await getSearchPaths(options);

	return tailgate('titanium:modules:detect', async () => {
		return [];
	});
}

function getSearchPaths(options: { searchPaths?: string[] }) {
	const searchPaths = new Set<string>();

	if (Array.isArray(options?.searchPaths)) {
		for (const path of options.searchPaths) {
			if (typeof path === 'string') {
				searchPaths.add(expand(path));
			}
		}
	}

	searchPaths.add(expand(config.titanium.sdk.installPath[process.platform]));

	const configPaths = config.titanium.sdk.searchPaths[process.platform];
	if (Array.isArray(configPaths)) {
		for (const path of configPaths) {
			searchPaths.add(expand(path));
		}
	}

	return Array.from(searchPaths);
}
