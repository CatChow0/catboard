import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT } from './tests/e2e/env';

const ci = !!process.env.CI;

export default defineConfig({
	testDir: 'tests/e2e',
	// One app and one set of fake services: specs run one after another.
	workers: 1,
	fullyParallel: false,
	retries: ci ? 1 : 0,
	timeout: 45_000,
	expect: { timeout: 8_000 },
	reporter: ci ? [['list'], ['junit', { outputFile: 'reports/e2e.xml' }], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: `http://127.0.0.1:${E2E_PORT}`,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		// The interface follows the browser language: the specs expect English.
		locale: 'en-US'
	},
	projects: [
		{ name: 'desktop', testIgnore: /phone\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } },
		{ name: 'phone', testMatch: /phone\.spec/, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } }
	],
	webServer: {
		command: 'node tests/e2e/server.ts',
		url: `http://127.0.0.1:${E2E_PORT + 1}/ready`,
		reuseExistingServer: false,
		timeout: 60_000,
		stdout: 'pipe'
	}
});
