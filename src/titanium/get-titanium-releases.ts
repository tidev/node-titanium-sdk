import { config } from '../config.js';
import { request } from '../util/request.js';

const os = process.platform === 'darwin' ? 'osx' : process.platform;

const sortTypes = ['local', 'nightly', 'beta', 'rc', 'ga'];

type TitaniumRelease = {
	name: string;
	version: string;
	date: string;
	assets: {
		os: string;
		url: string;
		size: number;
	}[];
	type: string;
};

/**
 * Retrieves the list of releases.
 * @param unstable - When `true`, returns beta and rc releases along with ga releases.
 * @returns {Promise<TitaniumRelease[]>}
 */
export async function getTitaniumReleases(unstable?: boolean): Promise<TitaniumRelease[]> {
	const releaseRE = /^(\d+)\.(\d+)\.(\d+)\.(\w+)$/;

	const fetches = [
		unstable &&
			request(config.titanium.sdk.downloadURLs.releases.beta, {
				responseType: 'json',
			}).then(async (res) => ({
				type: 'beta',
				releases: (await res.body.json()) as TitaniumRelease[],
			})),

		unstable &&
			request(config.titanium.sdk.downloadURLs.releases.rc, {
				responseType: 'json',
			}).then(async (res) => ({
				type: 'rc',
				releases: (await res.body.json()) as TitaniumRelease[],
			})),

		request(config.titanium.sdk.downloadURLs.releases.ga, {
			responseType: 'json',
		}).then(async (res) => ({
			type: 'ga',
			releases: (await res.body.json()) as TitaniumRelease[],
		})),
	];

	const results = await Promise.all(fetches);

	return results
		.flatMap((value) => {
			return value
				? value.releases.map((rel) => {
						rel.type = value.type;
						return rel;
					})
				: [];
		})
		.filter((r) => r.assets.some((a) => a.os === os))
		.sort((a, b) => {
			const aMatch = a.name.toLowerCase().match(releaseRE);
			const bMatch = b.name.toLowerCase().match(releaseRE);

			if (!aMatch || !bMatch) {
				return 0;
			}

			const [, amajor, aminor, apatch, atag] = aMatch;
			const [, bmajor, bminor, bpatch, btag] = bMatch;

			let n = parseInt(bmajor) - parseInt(amajor);
			if (n !== 0) {
				return n;
			}

			n = parseInt(bminor) - parseInt(aminor);
			if (n !== 0) {
				return n;
			}

			n = parseInt(bpatch) - parseInt(apatch);
			if (n !== 0) {
				return n;
			}

			return sortTypes.indexOf(btag) - sortTypes.indexOf(atag);
		});
}
