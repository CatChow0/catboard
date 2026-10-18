import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// In CI (Jenkins sets CI=true) tests also write JUnit reports for the build page,
// one file per project run (`--project unit` / `--project api`).
const ci = !!process.env.CI;
const suite = process.argv.includes('api') ? 'api' : 'unit';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		// Keep CSS readable by older Android WebViews (e.g. Chrome 91 on Android 12
		// without updates): stops the minifier from emitting `@media (width<=640px)`
		// range syntax, which Chrome only understands from version 104.
		cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14']
	},
	test: {
		reporters: ci ? ['default', ['junit', { outputFile: `reports/${suite}.xml` }]] : ['default'],
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['src/**/*.test.ts'],
					environment: 'node'
				}
			},
			{
				extends: true,
				test: {
					name: 'api',
					include: ['tests/api/**/*.test.ts'],
					environment: 'node',
					globalSetup: ['tests/api/setup.ts'],
					fileParallelism: false,
					testTimeout: 30_000,
					hookTimeout: 60_000
				}
			}
		],
		coverage: {
			provider: 'v8',
			include: ['src/lib/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/lib/types.ts'],
			reporter: ci ? ['text-summary', 'cobertura'] : ['text-summary', 'html'],
			reportsDirectory: 'coverage'
		}
	}
});
