import { Plist } from '../../../src/util/plist.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixturesDir = join(fileURLToPath(import.meta.url), '../fixtures');

describe('Plist', () => {
	describe('Basic Operations', () => {
		it('should handle missing properties', () => {
			const plist = new Plist().parse(`<?xml version="1.0"?>
			<plist version="1.0">
				<dict>
					<key>name</key>
					<string>test</string>
				</dict>
			</plist>`);
		});
	});
});
