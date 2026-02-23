import { tailgate } from '../util/tailgate.js';

type TitaniumModule = {
	name: string;
	version: string;
	platforms: string[];
	dependencies: string[];
	devDependencies: string[];
	optionalDependencies: string[];
};

export async function detectTitaniumModules(
	options: { searchPaths?: string[] } = {}
): Promise<TitaniumModule[]> {
	return tailgate('titanium:modules:detect', async () => {
		return [];
	});
}
