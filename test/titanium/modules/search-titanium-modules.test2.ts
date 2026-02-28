import { config, resetConfig } from '../../../src/config.js';
import { searchTitaniumModules, TiappXML } from '../../../src/titanium/index.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('queryTitaniumModules', () => {
	afterEach(() => resetConfig());

	it('should query Titanium modules', async () => {
		const tiapp = new TiappXML().parse(`<?xml version="1.0"?>
<ti:app xmlns:ti="http://ti.tidev.io">
	<modules>
		<module>test-module</module>
	</modules>
</ti:app>`);
		const data = tiapp.data();

		const results = await searchTitaniumModules({
			modules: data.modules,
		});

		console.log(results);
	});
});

/*
<modules>
<module platform="android">test-module</module>
</modules>

<modules>
<module platform="android">test-module</module>
</modules>

<modules>
<module version="1.2.3">ti.alltest</module>
<module platform="commonjs" version="1.2.3">test-module</module>
<module platform="android" version="7.8">ti.androidtest</module>
<module platform="iphone" version="9.0">ti.iphonetest</module>
</modules>
*/
