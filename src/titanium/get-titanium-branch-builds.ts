import { config } from '../config.js';
import { request } from '../util/request.js';

type TitaniumBuild = {
	name: string;
	version: string;
	date: string;
	expires: string;
	url: string;
	assets: {
		os: string;
		url: string;
		size: number;
	}[];
}

/**
 * Retrieves the list of builds for a given branch.
 * @param {String} branch - The name of the branch
 * @param {String} os - The name of the current OS (osx, linux, win32)
 * @returns {Promise<BranchBuild[]>}
 */
export async function getTitaniumBranchBuilds(branch: string, os: string): Promise<TitaniumBuild[]> {
	const res = await request(config.titanium.sdk.downloadURLs.branchBuilds.replace('${branch}', branch), {
		responseType: 'json'
	});
	const now = Date.now();
	const results = (await res.body.json()) as TitaniumBuild[];

	if (os === 'darwin') {
		os = 'osx';
	}

	return results.filter(b => {
		return (!b.expires || Date.parse(b.expires) > now) && b.assets.some(a => a.os === os);
	});
}
