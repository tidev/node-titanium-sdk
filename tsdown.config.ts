import { defineConfig, type UserConfig } from 'tsdown';

const config: UserConfig = defineConfig({
	entry: {
		index: './src/index.ts',
		'android/index': './src/android/index.ts',
		jdk: './src/jdk.ts',
		'titanium/index': './src/titanium/index.ts',
		'util/index': './src/util/index.ts',
	},
	format: ['es', 'cjs'],
	platform: 'node',
	tsconfig: './tsconfig.build.json',
});
export default config;
