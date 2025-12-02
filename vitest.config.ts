import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		allowOnly: true,
		coverage: {
			include: ['src/**/*.js'],
			reporter: ['html', 'lcov', 'text']
		},
		environment: 'node',
		globals: false,
		include: ['test/**/*.test.ts'],
		reporters: ['verbose'],
		silent: false,
		watch: false
	}
});
