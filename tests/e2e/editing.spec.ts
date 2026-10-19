// Dashboard editing: drag to move (pushing neighbours), resize, multi-select,
// context menu delete and copy; Add > Services; Settings Layout and Cache tabs.
// A safety net for refactoring Dashboard, AddPopup and SettingsModal.
import { test, expect, setDashboard, toggleEdit, openSettings, tile } from './fixtures';
import type { Page } from '@playwright/test';

const layoutItems = async (page: Page) => (await (await page.request.get('/api/layout?dashboard=main')).json()).layouts.desktop.items as { id: string; col: number; row: number; colSpan: number; rowSpan: number }[];
const pos = async (page: Page, id: string) => {
	const i = (await layoutItems(page)).find((x) => x.id === id)!;
	return { col: i.col, row: i.row, colSpan: i.colSpan, rowSpan: i.rowSpan };
};

/** Drags with the mouse from the centre of `from` by (dx, dy) pixels, in steps. */
async function dragBy(page: Page, selector: string, dx: number, dy: number) {
	const box = (await page.locator(selector).boundingBox())!;
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
	await page.mouse.up();
}

/** Width of one grid column plus gap, in pixels. */
async function step(page: Page) {
	return page.evaluate(() => {
		const grid = document.querySelector('.dashboard-grid') as HTMLElement;
		const cols = getComputedStyle(grid).gridTemplateColumns.split(' ');
		const gap = parseFloat(getComputedStyle(grid).columnGap);
		return { col: parseFloat(cols[0]) + gap, row: parseFloat(getComputedStyle(grid).gridAutoRows) + gap };
	});
}

test.beforeEach(async ({ page }) => {
	await setDashboard(page, [tile('a', 'clock', 0, 0, 2, 1), tile('b', 'clock', 0, 1, 2, 1), tile('c', 'notes', 4, 0, 2, 2)]);
	await page.goto('/');
	await expect(page.locator('[data-item-id="a"] .clock-tile')).toBeVisible();
});

test('dragging a tile moves it and pushes the tiles in the way', async ({ page }) => {
	await toggleEdit(page);
	const s = await step(page);
	// c (col 4, row 0) onto col 0, row 0: a and b are pushed down.
	await dragBy(page, '[data-item-id="c"]', -4 * s.col, 0);
	await expect.poll(() => pos(page, 'c')).toEqual({ col: 0, row: 0, colSpan: 2, rowSpan: 2 });
	expect(await pos(page, 'a')).toEqual({ col: 0, row: 2, colSpan: 2, rowSpan: 1 });
	expect(await pos(page, 'b')).toEqual({ col: 0, row: 3, colSpan: 2, rowSpan: 1 });
});

test('a drag outside edit mode does nothing', async ({ page }) => {
	const s = await step(page);
	await dragBy(page, '[data-item-id="c"]', -4 * s.col, 0);
	await page.waitForTimeout(500);
	expect(await pos(page, 'c')).toEqual({ col: 4, row: 0, colSpan: 2, rowSpan: 2 });
});

test('the resize handle changes the size and pushes the neighbour', async ({ page }) => {
	await toggleEdit(page);
	const s = await step(page);
	await dragBy(page, '[data-item-id="a"] .resize-handle', s.col, s.row);
	await expect.poll(() => pos(page, 'a')).toEqual({ col: 0, row: 0, colSpan: 3, rowSpan: 2 });
	expect((await pos(page, 'b')).row).toBe(2);
});

test('Escape cancels a drag in progress', async ({ page }) => {
	await toggleEdit(page);
	const s = await step(page);
	const box = (await page.locator('[data-item-id="c"]').boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 - 2 * s.col, box.y + box.height / 2, { steps: 8 });
	await page.keyboard.press('Escape');
	await page.mouse.up();
	await page.waitForTimeout(400);
	expect(await pos(page, 'c')).toEqual({ col: 4, row: 0, colSpan: 2, rowSpan: 2 });
});

test('ctrl+click selects several tiles, the context menu deletes them', async ({ page }) => {
	page.on('dialog', (d) => d.accept());
	await toggleEdit(page);
	await page.click('[data-item-id="a"]', { modifiers: ['Control'] });
	await page.click('[data-item-id="b"]', { modifiers: ['Control'] });
	await expect(page.locator('.item-wrapper.selected')).toHaveCount(2);
	await page.click('[data-item-id="a"]', { button: 'right' });
	await page.getByText('Delete 2 tiles').click();
	await expect.poll(async () => (await layoutItems(page)).map((i) => i.id)).toEqual(['c']);
});

test('the context menu copies a tile to another breakpoint', async ({ page }) => {
	await toggleEdit(page);
	await page.click('[data-item-id="c"]', { button: 'right' });
	await page.getByText('Copy to').hover();
	await page.locator('.ctx-menu, [role="menu"]').getByText('Home').first().hover();
	await page.locator('[role="menu"] >> text=Mobile').last().click();
	const layout = await (await page.request.get('/api/layout?dashboard=main')).json();
	await expect.poll(async () => (await (await page.request.get('/api/layout?dashboard=main')).json()).layouts.mobile.items.some((i: { type: string }) => i.type === 'notes')).toBe(true);
	void layout;
});

test('Add > Services registers a service and puts it on the dashboard', async ({ page }) => {
	await toggleEdit(page);
	await page.click('button[title="Add service or widget"]');
	await page.click('.tab:has-text("Services")');
	await page.click('.btn-register');
	await page.locator('.register-form input[placeholder="Proxmox"]').fill('Gitea');
	await page.locator('.register-form input[type="url"]').fill('http://127.0.0.1:9/gitea');
	await page.locator('.register-form .btn-save').click();
	await expect(page.locator('.svc-card, .service-card, [class*="card"]', { hasText: 'Gitea' }).first()).toBeVisible();
	const services = (await (await page.request.get('/api/services')).json()).services as { name: string; id: string }[];
	const gitea = services.find((x) => x.name === 'Gitea')!;
	await expect.poll(async () => (await layoutItems(page)).some((i) => (i as unknown as { serviceId?: string }).serviceId === gitea.id)).toBe(true);
	await page.click('.btn-close');
	// A 1x1 service tile shows its icon only.
	await expect(page.locator('.cb-item-service')).toHaveCount(1);
	await page.request.delete(`/api/services/${gitea.id}`);
});

test('Settings > Layout saves the grid of a dashboard', async ({ page }) => {
	await openSettings(page);
	await page.click('.tab:has-text("Layout")');
	await page.locator('input[type="number"]').filter({ hasNot: page.locator('[id^="bp-"]') }).first().scrollIntoViewIfNeeded();
	await page.locator('.field-row:has-text("Cell size") input, .field-row:has-text("Cell") input').first().fill('100');
	await page.getByRole('button', { name: 'Save' }).last().click();
	await expect(page.locator('.theme-grid')).toHaveCount(0);
	await expect.poll(async () => (await (await page.request.get('/api/layout?dashboard=main')).json()).layouts.desktop.grid?.cellSize).toBe(100);
	await page.request.post('/api/layout/dashboards', { data: { action: 'settings', dashboard: 'main', breakpoint: 'desktop' } });
});

test('Settings > Cache shows the stats and rebuilds for the admin', async ({ page }) => {
	await openSettings(page);
	await page.click('.tab:has-text("Cache")');
	await expect(page.getByRole('button', { name: 'Rebuild Icon Cache' })).toBeVisible();
	await page.getByRole('button', { name: 'Rebuild Icon Cache' }).click();
	await expect(page.locator('.cache-result')).toContainText('Rebuilt');
});
