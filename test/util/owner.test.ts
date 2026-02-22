import { dirname } from 'node:path';
import { getOwner, getOwnerSync } from '../../src/util/owner.js';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);

describe('getOwner()', () => {
	it('should get owner of a file', async () => {
		const owner = await getOwner(__filename);
		expect(owner.gid).toBeDefined();
		expect(owner.origin).toBe(dirname(__filename));
		expect(owner.target).toBe(__filename);
		expect(owner.supported).toBe(process.platform !== 'win32');
		expect(owner.uid).toBeDefined();
	});
});

describe('getOwnerSync()', () => {
	it('should get owner of a file', () => {
		const owner = getOwnerSync(__filename);
		expect(owner.gid).toBeDefined();
		expect(owner.origin).toBe(dirname(__filename));
		expect(owner.target).toBe(__filename);
		expect(owner.supported).toBe(process.platform !== 'win32');
		expect(owner.uid).toBeDefined();
	});
});
