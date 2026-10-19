import { test, expect, openSettings } from './fixtures';

test('the admin backs up, then restores from Settings > Export', async ({ page }) => {
	await page.goto('/');
	await openSettings(page);
	await page.click('.tab:has-text("Export")');
	const panel = page.locator('.backups');
	await expect(panel).toBeVisible();
	await panel.getByRole('button', { name: 'Back up now' }).click();
	await expect(panel.locator('.bk-msg')).toHaveText('Backup made');
	const rows = panel.locator('.bk-list li');
	await expect(rows.first()).toContainText('Manual');
	await expect(rows.first().getByRole('link', { name: 'Download' })).toHaveAttribute('href', /\/api\/backups\//);
	await rows.first().getByRole('button', { name: 'Restore' }).click();
	await rows.first().getByRole('button', { name: 'Confirm restore' }).click();
	await expect(panel.locator('.bk-msg')).toContainText('Restored');
	await expect(rows.first()).toContainText('Before restore');
});
