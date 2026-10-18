// Core flows: login, lazy widgets, catalog, hidden tab.
import { test as raw, expect as rawExpect } from '@playwright/test';
import { test, expect, setDashboard, toggleEdit, addWidget, tile } from './fixtures';
import { ADMIN } from './env';

raw('login page signs in and out', async ({ page }) => {
	await page.goto('/');
	await rawExpect(page).toHaveURL(/\/login$/);
	await page.fill('input[autocomplete="username"], input[name="username"], #username', ADMIN.username);
	await page.fill('input[type="password"]', 'wrong-password');
	await page.keyboard.press('Enter');
	await rawExpect(page.getByText(/invalid/i)).toBeVisible();
	await page.fill('input[type="password"]', ADMIN.password);
	await page.keyboard.press('Enter');
	await rawExpect(page.locator('.navbar')).toBeVisible();
});

const ALL = ['calendar', 'clock', 'weather', 'docker', 'uptime-kuma-status-page', 'adguard-home', 'adguard-home-control', 'jellyfin-latest', 'arr-releases', 'stacker', 'jellyfin-now-playing', 'jellyseerr-requests', 'qbittorrent', 'notes', 'spoolman', 'elegoo-print', 'jenkins', 'psitransfer', 'proxmox', 'portainer', 'immich', 'nextcloud'];

test('a small dashboard only downloads the code it shows', async ({ page }) => {
	await setDashboard(page, [tile('c1', 'clock', 0, 0, 2, 1)]);
	await page.goto('/');
	await expect(page.locator('.cb-item-clock .clock-tile')).toBeVisible();
	const scripts = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.js')).map((e) => e.name));
	expect(scripts.some((s) => /Proxmox|Jenkins/.test(s))).toBe(false);
	const kb = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.js')).reduce((a, e) => a + (e as PerformanceResourceTiming).decodedBodySize, 0) / 1024);
	expect(kb).toBeLessThan(300);
});

test('every widget type renders without error', async ({ page }) => {
	await setDashboard(
		page,
		ALL.map((t, i) => tile(`w${i}`, t, (i % 2) * 5, Math.floor(i / 2) * 3, 5, 3, t === 'proxmox' ? { clusterId: 'c1' } : t === 'jenkins' ? {} : undefined)),
		['navbar-cpu', 'navbar-ram', 'navbar-clock', 'navbar-jenkins', 'navbar-proxmox'].map((t, i) => ({ id: `n${i}`, type: t, col: 2 + i, colSpan: 1 }))
	);
	await page.goto('/');
	await expect(page.locator('.cb-item-nextcloud')).toBeAttached();
	await expect(page.locator('.cb-skeleton')).toHaveCount(0, { timeout: 15_000 });
	for (const t of ALL) await expect(page.locator(`.cb-item-${t} > *`), t).toHaveCount(1);
	await expect(page.locator('.cb-widget-failed')).toHaveCount(0);
});

test('a hidden tab stops polling, a visible one resumes', async ({ page }) => {
	await setDashboard(page, [tile('c1', 'clock', 0, 0, 2, 1), tile('j', 'jenkins', 2, 0, 4, 3, {})]);
	await page.goto('/');
	await expect(page.locator('.jk-tile')).toBeVisible();
	const setHidden = (h: boolean) =>
		page.evaluate((h) => {
			Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
			Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
			document.dispatchEvent(new Event('visibilitychange'));
		}, h);
	await setHidden(true);
	const calls: string[] = [];
	page.on('request', (r) => r.url().includes('/api/') && calls.push(r.url()));
	await page.waitForTimeout(4000);
	expect(calls).toEqual([]);
	await setHidden(false);
	await expect.poll(() => calls.some((u) => u.includes('/api/system-stats')) && calls.some((u) => u.includes('/api/status'))).toBe(true);
});

test('widgets are added from the catalog and edited with the same form', async ({ page }) => {
	await setDashboard(page, []);
	await page.goto('/');
	await toggleEdit(page);
	await page.click('button[title="Add service or widget"]');
	await page.click('.tab:has-text("Widgets")');
	await page.click('.cat:has-text("Virtualisation")');
	await expect(page.locator('.wcard-name')).toContainText(['Proxmox VE', 'Portainer stacks']);
	await page.click('.btn-close');

	await addWidget(page, 'jenkins', async () => {
		await page.click('.configure .seg button:has-text("One project")');
		await expect(page.locator('.cfg-actions .btn-save')).toBeDisabled();
		await page.selectOption('.configure select', 'team/deploy');
	});
	await expect(page.locator('.jk-tile')).toBeVisible();
	await page.click('button[title="Edit Jenkins widget"]');
	await expect(page.locator('.wm')).toBeVisible();
	await expect(page.locator('.wm select')).toHaveValue('team/deploy');
	await page.keyboard.press('Escape');
	await expect(page.locator('.wm')).toBeHidden();
	await toggleEdit(page);
	await expect(page.locator('.jk-title')).toHaveText('deploy');
});
