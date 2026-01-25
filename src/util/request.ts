import { config } from '../config.js';
import { Agent, ProxyAgent, request as req } from 'undici';
import type { Dispatcher } from 'undici';

type RequestOptions<TOpaque = null> = { dispatcher?: Dispatcher }
	& Omit<Dispatcher.RequestOptions<TOpaque>, 'origin' | 'path' | 'method'>
	& Partial<Pick<Dispatcher.RequestOptions, 'method'>>
	& { responseType?: 'json' };

export async function request<TOpaque = null>(
	url: string,
	opts: RequestOptions<TOpaque> = {}
): Promise<Dispatcher.ResponseData<TOpaque>> {
	const proxyUrl = config.network.httpProxy;
	const requestTls = {
		rejectUnauthorized: config.network.strictSSL
	};

	const dispatcher = proxyUrl
		? new ProxyAgent({
			uri: proxyUrl,
			requestTls
		})
		: new Agent({
			connect: requestTls
		});

	return await req(url, {
		dispatcher,
		reset: true,
		...opts,
		headers: {
			Connection: 'close',
			...opts.headers
		}
	});
}
