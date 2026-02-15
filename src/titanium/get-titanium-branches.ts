import { config } from '../config.js';
import { request } from '../util/request.js';

/**
 * Retrieves the list of branches.
 * @returns {Promise<Branches>}
 */
export async function getTitaniumBranches(): Promise<string[]> {
	const res = await request(config.titanium.sdk.downloadURLs.branches, {
		responseType: 'json',
	});
	return Object.entries((await res.body.json()) as Record<string, number>)
		.filter(([, count]) => count)
		.map(([name]) => name);
}
