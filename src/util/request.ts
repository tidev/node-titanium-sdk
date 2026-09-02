import { config } from '../config.js';
import { Agent, ProxyAgent, request as req } from 'undici';
import type { Dispatcher } from 'undici';

const openDispatchers = new Set<Dispatcher>();

type RequestOptions<TOpaque = null> = { dispatcher?: Dispatcher } & Omit<
	Dispatcher.RequestOptions<TOpaque>,
	'origin' | 'path' | 'method'
> &
	Partial<Pick<Dispatcher.RequestOptions, 'method'>> & { responseType?: 'json' };

/**
 * Makes a request to the given URL.
 * @param url - The URL to request.
 * @param opts - The options for the request.
 * @returns The response data.
 */
export async function request<TOpaque = null>(
	url: string,
	opts: RequestOptions<TOpaque> = {}
): Promise<Dispatcher.ResponseData<TOpaque>> {
	const proxyUrl = config.network.httpProxy;
	const requestTls = {
		rejectUnauthorized: config.network.strictSSL,
	};

	const dispatcher = proxyUrl
		? new ProxyAgent({
				uri: proxyUrl,
				requestTls,
			})
		: new Agent({
				connect: requestTls,
			});

	openDispatchers.add(dispatcher);

	const res = await req(url, {
		dispatcher,
		reset: true,
		...opts,
		headers: {
			Connection: 'close',
			...opts.headers,
		},
	});

	let closed = false;
	const closeDispatcher = () => {
		if (!closed) {
			closed = true;
			openDispatchers.delete(dispatcher);
			dispatcher.close().catch(() => {});
		}
	};
	res.body.once('end', closeDispatcher);
	res.body.once('error', closeDispatcher);
	res.body.once('close', closeDispatcher);

	return res;
}
