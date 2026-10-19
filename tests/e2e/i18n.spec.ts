// French: browser language by default, the account's choice wins, and API
// errors arrive in the chosen language.
import { test as raw, expect as rawExpect } from '@playwright/test';
import { test, expect, setDashboard, resetSettings, openSettings, tile } from './fixtures';
import { ADMIN } from './env';

async function reset({ page }: { page: import('@playwright/test').Page }) {
	await resetSettings(page);
	await setDashboard(page, [tile('c1', 'clock', 0, 0, 3, 2)]);
}

test.describe('French browser', () => {
	test.use({ locale: 'fr-FR' });
	test.beforeEach(reset);

	test('the interface follows the browser language', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
		await page.getByRole('button', { name: 'Options' }).click();
		await page.getByText('Réglages', { exact: true }).first().click();
		await expect(page.getByRole('heading', { name: 'Thème de couleurs' })).toBeVisible();
		await expect(page.locator('#language')).toHaveValue('auto');
	});

	test('the add popup and the catalog are translated', async ({ page }) => {
		await page.goto('/');
		await page.click('button[title="Mode édition"]');
		await page.click('button[title="Ajouter un service ou un widget"]');
		await page.click('.tab:has-text("Widgets")');
		await expect(page.locator('.cat', { hasText: 'Impression 3D' })).toBeVisible();
		await page.fill('input[aria-label="Rechercher un widget"]', 'horloge');
		await expect(page.locator('.wcard-name', { hasText: 'Horloge' })).toBeVisible();
	});
});

test('the account choice wins over the browser language', async ({ page }) => {
	await reset({ page });
	await page.goto('/');
	await openSettings(page);
	await page.selectOption('#language', 'fr');
	await page.click('.btn-save');
	await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
	await page.reload();
	await expect(page.locator('button[title="Mode édition"]')).toBeVisible();
	await resetSettings(page);
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.locator('button[title="Toggle edit mode"]')).toBeVisible();
});

raw.describe('French login', () => {
	raw.use({ locale: 'fr-FR' });

	raw('server errors are translated', async ({ page }) => {
		await page.goto('/login');
		await rawExpect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
		await page.fill('input[autocomplete="username"], input[name="username"], #username', ADMIN.username);
		await page.fill('input[type="password"]', 'wrong-password');
		await page.keyboard.press('Enter');
		await rawExpect(page.getByText('Identifiants invalides')).toBeVisible();
	});
});
