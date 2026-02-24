import { config, resetConfig } from '../../../src/config.js';
import { describe, it, expect } from 'vitest';
import { detectTitaniumModules } from '../../../src/titanium/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('detectTitaniumModules', () => {
	it('should detect Titanium modules', async () => {
		const modules = await detectTitaniumModules();
		expect(modules).toBeDefined();
	});
});
