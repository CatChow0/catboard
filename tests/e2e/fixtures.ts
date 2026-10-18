// `test` with a signed-in admin, page errors collected (a spec fails on any
// uncaught error), and helpers to set the dashboard and open dialogs.
import { test as base, expect, type Page } from '@playwright/test';
import { ADMIN } from './env';

type Item = Record<string, unknown> & { id: string; type: string };

export const test = base.extend<{ pageErrors: string[] }>({
	pageErrors: async ({ page }, use) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await use(errors);
		expect(errors, 'uncaught errors in the page').toEqual([]);
	},
	page: async ({ page }, use) => {
		const res = await page.request.post('/api/auth/login', { data: ADMIN });
		expect(res.ok()).toBe(true);
		await use(page);
	}
});
export { expect };

/** Replaces the desktop tiles and navbar widgets of the main dashboard. */
export async function setDashboard(page: Page, items: Item[], navbar: Item[] = [], breakpoint = 'desktop') {
	const layout = await (await page.request.get('/api/layout?dashboard=main')).json();
	const per = layout.layouts[breakpoint];
	per.items = items;
	per.navbar.items = [...per.navbar.items.filter((i: Item) => i.type === 'navbar-title'), ...navbar];
	const res = await page.request.put('/api/layout?dashboard=main', { data: layout });
	expect(res.ok()).toBe(true);
}

export async function resetSettings(page: Page, extra: Record<string, unknown> = {}) {
	const s = await (await page.request.get('/api/settings')).json();
	for (const k of ['customCss', 'radius', 'accent', 'font', 'fontScale', 'cardOpacity', 'cardBlur', 'autoDark', 'autoLight', 'customPalette']) delete s[k];
	await page.request.put('/api/settings', { data: { ...s, theme: 'dark', ...extra } });
}

export async function openSettings(page: Page) {
	await page.locator('.dropdown-trigger, button[title="Options"], button[aria-label="Options"]').first().click();
	await page.getByText('Settings', { exact: true }).first().click();
	await expect(page.locator('.theme-grid')).toBeVisible();
}

export async function toggleEdit(page: Page) {
	await page.click('button[title="Toggle edit mode"]');
}

/** Adds a widget from the catalog (edit mode must be on). */
export async function addWidget(page: Page, search: string, configure?: () => Promise<void>) {
	await page.click('button[title="Add service or widget"]');
	await page.click('.tab:has-text("Widgets")');
	await page.fill('input[aria-label="Search widgets"]', search);
	await page.locator('.wcard-main').first().click();
	await expect(page.locator('.configure')).toBeVisible();
	if (configure) await configure();
	await page.click('.cfg-actions .btn-save');
	await expect(page.locator('.configure')).toBeHidden();
}

export const tile = (id: string, type: string, col: number, row: number, colSpan = 4, rowSpan = 3, config?: object): Item => ({ id, type, col, row, colSpan, rowSpan, ...(config ? { config } : {}) });
