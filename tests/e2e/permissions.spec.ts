// What a plain user sees depending on "Who can edit dashboards", and the
// login attempt limit message.
import { test as base, expect, type Page } from '@playwright/test';
import { setDashboard, tile } from './fixtures';
import { ADMIN, USER } from './env';

const test = base.extend<{ admin: Page }>({
	admin: async ({ browser }, use) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await page.request.post('/api/auth/login', { data: ADMIN });
		await use(page);
		await page.request.put('/api/access', { data: { dashboardEditors: 'admins' } });
		await ctx.close();
	}
});

test('with "Admins only", a user sees the dashboard read-only', async ({ page, admin }) => {
	await admin.request.put('/api/access', { data: { dashboardEditors: 'admins' } });
	await setDashboard(admin, [tile('n', 'notes', 0, 0, 4, 2, { content: '- [ ] task' }), tile('a', 'adguard-home-control', 4, 0, 3, 2)]);
	await page.request.post('/api/auth/login', { data: USER });
	await page.goto('/');
	await expect(page.locator('.cb-item-notes .nt-body')).toBeVisible();
	await expect(page.locator('button[title="Toggle edit mode"]')).toHaveCount(0);
	await expect(page.locator('.cb-item-notes button[aria-label="Edit note"]')).toHaveCount(0);
	await expect(page.locator('.cb-item-notes input[type="checkbox"]')).toBeDisabled();
	await expect(page.locator('.cb-item-adguard-home-control .status-pill')).toBeDisabled();
	await page.keyboard.press('e');
	await expect(page.locator('button[title="Add service or widget"]')).toHaveCount(0);
});

test('with "Every user", a user can edit', async ({ page, admin }) => {
	await admin.goto('/');
	await admin.locator('.dropdown-trigger, button[title="Options"], button[aria-label="Options"]').first().click();
	await admin.getByText('Settings', { exact: true }).first().click();
	await admin.click('.tab:has-text("Admin")');
	await admin.click('.access .seg button:has-text("Every user")');
	await expect(admin.locator('.access-msg')).toHaveText('Saved');

	await setDashboard(admin, [tile('n', 'notes', 0, 0, 4, 2, { content: '- [ ] task' })]);
	await page.request.post('/api/auth/login', { data: USER });
	await page.goto('/');
	await expect(page.locator('button[title="Toggle edit mode"]')).toBeVisible();
	await expect(page.locator('.cb-item-notes input[type="checkbox"]')).toBeEnabled();
});

test('the login page explains a temporary block', async ({ page, admin }) => {
	await admin.request.post('/api/users', { data: { username: 'blocked-e2e', password: 'blocked-pass', role: 'user' } });
	await page.goto('/login');
	await page.fill('input[autocomplete="username"], input[name="username"], #username', 'blocked-e2e');
	for (let i = 0; i < 5; i++) {
		await page.fill('input[type="password"]', `wrong-${i}`);
		await page.keyboard.press('Enter');
		await expect(page.locator('.error')).toBeVisible();
	}
	await page.fill('input[type="password"]', 'blocked-pass');
	await page.keyboard.press('Enter');
	await expect(page.locator('.error')).toContainText('Too many attempts');
	await admin.request.delete('/api/users/blocked-e2e');
});
