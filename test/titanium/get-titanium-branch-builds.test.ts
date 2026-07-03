import { config, resetConfig } from '../../src/config.js';
import { getTitaniumBranchBuilds } from '../../src/titanium/index.js';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const branchBuildsJson = readFileSync(join(__dirname, 'branch-builds.json'));

describe('getTitaniumBranchBuilds()', () => {
	let server: Server;

	beforeEach(async () => {
		server = createServer((_req, res) => {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(branchBuildsJson);
		});

		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

		const { port } = server.address() as { port: number };
		config.titanium.sdk.downloadURLs.branchBuilds = `http://127.0.0.1:${port}/\${branch}.json`;
	});

	afterEach(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		resetConfig();
	});

	it('should return the list of builds for Linux', async () => {
		const builds = await getTitaniumBranchBuilds('13_1_X', 'linux');
		expect(builds).toBeDefined();
		const build = builds[0];
		expect(build.name).toMatch(/^13\.1./);
		expect(build.version).toMatch(/^13\.1./);
		expect(build.date).toBeDefined();
		expect(build.expires).toBeDefined();
		expect(build.url.startsWith('https://github.com/tidev/titanium-sdk/actions/runs/')).toBe(true);
		expect(build.assets).toBeDefined();
		expect(build.assets.length).toBeGreaterThan(0);
		expect(build.assets.map((asset) => asset.os).sort()).toEqual(['linux', 'osx', 'win32']);
		expect(build.assets.every((asset) => asset.url !== undefined)).toBe(true);
		expect(build.assets.every((asset) => asset.size > 0)).toBe(true);
	});

	it('should return the list of builds for macOS', async () => {
		const builds = await getTitaniumBranchBuilds('13_1_X', 'osx');
		expect(builds).toBeDefined();
		const build = builds[0];
		expect(build.name).toMatch(/^13\.1./);
		expect(build.version).toMatch(/^13\.1./);
		expect(build.date).toBeDefined();
		expect(build.expires).toBeDefined();
		expect(build.url.startsWith('https://github.com/tidev/titanium-sdk/actions/runs/')).toBe(true);
		expect(build.assets).toBeDefined();
		expect(build.assets.length).toBeGreaterThan(0);
		expect(build.assets.map((asset) => asset.os).sort()).toEqual(['linux', 'osx', 'win32']);
		expect(build.assets.every((asset) => asset.url !== undefined)).toBe(true);
		expect(build.assets.every((asset) => asset.size > 0)).toBe(true);
	});

	it('should return the list of builds for Windows', async () => {
		const builds = await getTitaniumBranchBuilds('13_1_X', 'win32');
		expect(builds).toBeDefined();
		const build = builds[0];
		expect(build.name).toMatch(/^13\.1./);
		expect(build.version).toMatch(/^13\.1./);
		expect(build.date).toBeDefined();
		expect(build.expires).toBeDefined();
		expect(build.url.startsWith('https://github.com/tidev/titanium-sdk/actions/runs/')).toBe(true);
		expect(build.assets).toBeDefined();
		expect(build.assets.length).toBeGreaterThan(0);
		expect(build.assets.map((asset) => asset.os).sort()).toEqual(['linux', 'osx', 'win32']);
		expect(build.assets.every((asset) => asset.url !== undefined)).toBe(true);
		expect(build.assets.every((asset) => asset.size > 0)).toBe(true);
	});
});
