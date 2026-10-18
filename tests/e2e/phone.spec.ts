import { test, expect, setDashboard, tile } from './fixtures';

test('phone layout: widgets fit the screen, settings open from the menu', async ({ page }) => {
	await setDashboard(page, [tile('c', 'clock', 0, 0, 4, 1), tile('x', 'proxmox', 0, 1, 4, 3, { clusterId: 'c1' }), tile('n', 'nextcloud', 0, 4, 4, 3)], [], 'mobile');
	await page.goto('/');
	await expect(page.locator('.px-tile .px-guests li').first()).toBeVisible();
	await expect(page.locator('.nc-tile .nc-files li').first()).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	await page.click('button[aria-label="Menu"]');
	await page.click('.mm-item:has-text("Settings")');
	await expect(page.locator('.theme-grid')).toBeVisible();
	await page.locator('.css-editor').scrollIntoViewIfNeeded();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
