import { readFile } from 'node:fs/promises';
import { test, expect, setDashboard, resetSettings, openSettings, tile } from './fixtures';

const rootVar = (page: import('@playwright/test').Page, name: string) =>
	page.evaluate((n) => getComputedStyle(document.querySelector('.cb-root')!).getPropertyValue(n).trim(), name);

test.beforeEach(async ({ page }) => {
	await resetSettings(page);
	await setDashboard(page, [tile('c1', 'clock', 0, 0, 3, 2), tile('n1', 'notes', 3, 0, 3, 2)]);
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.locator('.cb-item-clock .clock-tile')).toBeVisible();
});

test('themes apply live and closing without saving restores the look', async ({ page }) => {
	await openSettings(page);
	for (const name of ['Rosé Pine', 'Kanagawa', 'GitHub Light', 'OLED Black', 'Auto', 'Custom']) await expect(page.locator('.theme-card', { hasText: name })).toBeVisible();
	await page.click('.theme-card:has-text("Rosé Pine")');
	expect(await rootVar(page, '--bg-primary')).toBe('#191724');
	await page.click('.modal-header .btn-close');
	await expect.poll(() => rootVar(page, '--bg-primary')).toBe('#0f0f1a');
});

test('the Auto theme follows the colour scheme', async ({ page }) => {
	await openSettings(page);
	await page.click('.theme-card:has-text("Auto")');
	await page.selectOption('#auto-dark', 'kanagawa');
	await page.selectOption('#auto-light', 'github-light');
	expect(await rootVar(page, '--bg-primary')).toBe('#1f1f28');
	await page.emulateMedia({ colorScheme: 'light' });
	await expect.poll(() => rootVar(page, '--bg-primary')).toBe('#f6f8fa');
});

test('custom CSS applies live, is saved, and ?nocss skips it', async ({ page }) => {
	await openSettings(page);
	await page.fill('.css-editor', '.cb-item-clock { outline: 3px solid rgb(0, 255, 0); }\n/* </style><script>window.__pwned = 1</script> */');
	const outline = () => page.evaluate(() => getComputedStyle(document.querySelector('.cb-item-clock')!).outlineColor);
	await expect.poll(outline).toBe('rgb(0, 255, 0)');
	expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
	await page.locator('#radius').fill('0');
	await page.getByRole('button', { name: 'Save' }).last().click();
	await expect(page.locator('.theme-grid')).toBeHidden();

	await page.reload();
	await expect(page.locator('.cb-item-clock .clock-tile')).toBeVisible();
	await expect.poll(outline).toBe('rgb(0, 255, 0)');
	await page.goto('/?nocss');
	await expect(page.locator('.cb-item-clock .clock-tile')).toBeVisible();
	await expect(page.locator('#cb-custom-css')).toHaveCount(0);
	expect(await rootVar(page, '--radius')).toBe('0px');
});

test('a theme file exports the look and imports it back', async ({ page }) => {
	await openSettings(page);
	await page.click('.theme-card:has-text("Everforest")');
	await page.locator('label.toggle-switch:has(#accent-on)').click();
	await page.locator('.accent-input').fill('#ff00aa');
	await page.locator('#card-blur').fill('6');
	const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Export theme")')]);
	const file = JSON.parse(await readFile((await download.path())!, 'utf8'));
	expect(file).toMatchObject({ theme: 'everforest', accent: '#ff00aa', cardBlur: 6 });
	await page.click('.modal-header .btn-close');
	await expect.poll(() => rootVar(page, '--bg-primary')).toBe('#0f0f1a');

	await openSettings(page);
	await page.setInputFiles('.theme-file input[type=file]', { name: 'look.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
	await expect(page.locator('.theme-message')).not.toHaveClass(/error/);
	expect(await rootVar(page, '--bg-primary')).toBe('#2d353b');
	expect(await rootVar(page, '--accent')).toBe('#ff00aa');
	await page.setInputFiles('.theme-file input[type=file]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
	await expect(page.locator('.theme-message.error')).toBeVisible();
});

test('light themes keep text readable in dialogs', async ({ page }) => {
	await resetSettings(page, { theme: 'github-light' });
	await page.reload();
	await openSettings(page);
	const color = await page.evaluate(() => getComputedStyle(document.querySelector('.modal-header h2')!).color);
	expect(color).toBe('rgb(31, 35, 40)');
});
