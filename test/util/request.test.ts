import { config } from '../../src/config.js';
import { request } from '../../src/util/request.js';
import assert from 'node:assert';
import { createServer } from 'node:http';
import { Socket } from 'node:net';
import { createProxy } from 'proxy';
import { afterEach, beforeEach, describe, it } from 'vitest';

let origProxyUrl;

describe('request', () => {
	beforeEach(() => {
		origProxyUrl = config.network.httpProxy;
		config.network.httpProxy = null;
	});

	afterEach(() => {
		config.network.httpProxy = origProxyUrl;
	});

	it('should fetch TiDev page', async () => {
		const res = await request('https://github.com');
		await res.body.text();
		assert.strictEqual(res.statusCode, 200);
	});

	it.skipIf(typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined')(
		'should fetch TiDev page via proxy', async () => {
		const connections: Record<string, Socket> = {};
		const server = createServer();
		server.on('connection', function (conn) {
			const key = `${conn.remoteAddress}:${conn.remotePort}`;
			connections[key] = conn;
			conn.on('close', () => {
				delete connections[key];
			});
		});
		createProxy(server).listen(9999);

		try {
			config.network.httpProxy = 'http://localhost:9999';

			const res = await request('https://github.com');
			await res.body.text();
			assert.strictEqual(res.statusCode, 200);
		} finally {
			for (const conn of Object.values(connections)) {
				conn.destroy();
			}
			await new Promise((resolve) => server.close(resolve));
		}
	}, 10000);
});
