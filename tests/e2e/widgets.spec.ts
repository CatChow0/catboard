// Integration widgets against the fake services.
import { test, expect, setDashboard, openSettings, tile } from './fixtures';

test('PsiTransfer: pick files, send, get a link', async ({ page }) => {
	await setDashboard(page, [tile('p', 'psitransfer', 0, 0, 4, 3)]);
	await page.goto('/');
	await page.evaluate(() => localStorage.removeItem('catboard:psitransfer-history'));
	const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.ps-zone')]);
	expect(chooser.isMultiple()).toBe(true);
	await chooser.setFiles([
		{ name: 'report.txt', mimeType: 'text/plain', buffer: Buffer.from('CatBoard report\n') },
		{ name: 'big.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(900 * 1024, 7) }
	]);
	await expect(page.locator('.ps-files li')).toHaveCount(2);
	await page.selectOption('.ps-opts select', '86400');
	await page.click('.ps-actions .ps-btn.primary');
	await expect(page.locator('.ps-done')).toBeVisible({ timeout: 20_000 });
	await expect(page.locator('.ps-url')).toHaveValue(/^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{12}$/);
	await page.reload();
	await expect(page.locator('.ps-history li')).toHaveCount(1);
});

test('Jenkins: Run opens the parameter form with the defaults and queues a build', async ({ page }) => {
	await setDashboard(page, [tile('j', 'jenkins', 0, 0, 4, 3, { job: 'team/deploy' })]);
	await page.goto('/');
	await page.click('.jk-tile .run');
	await expect(page.locator('.wm input[type="text"]')).toHaveValue('prod-1');
	await page.selectOption('.wm select', 'staging');
	await page.click('.wm-save');
	await expect(page.locator('.jk-tile .msg')).toHaveText('Queued');
	await expect(page.locator('.jk-tile .jb li').first()).toBeVisible({ timeout: 20_000 });
});

test('Proxmox: start a guest, confirm before stopping one', async ({ page }) => {
	await setDashboard(page, [tile('x', 'proxmox', 0, 0, 5, 4, { clusterId: 'c1' })], [{ id: 'np', type: 'navbar-proxmox', col: 2, colSpan: 2, config: { clusterId: 'c1' } }]);
	await page.goto('/');
	await expect(page.locator('.px-tile .px-guests li')).toHaveCount(3);
	const row = (name: string) => page.locator('.px-tile .px-guests li', { hasText: name });
	const stopped = (await row('windows-11').locator('.dot.running').count()) ? 'home-assistant' : 'windows-11';
	if (stopped === 'home-assistant') {
		await row('home-assistant').locator('button[title^="Shut down"]').click();
		await page.click('.wm-save');
	}
	await row('windows-11').locator('button[title^="Start"], button[title^="Shut down"]').first().click();
	if (await page.locator('.wm').count()) await page.click('.wm-save');
	await expect(page.locator('.px-tile .px-msg')).toContainText('sent');

	await row('pihole').locator('button[title^="Shut down"]').click();
	await expect(page.locator('.wm')).toContainText('Shut down pihole?');
	await page.click('.wm .btn-ghost:has-text("Force stop")');
	await expect(page.locator('.wm')).toContainText('Stop pihole?');
	await page.click('.wm-save');
	await expect(page.locator('.px-tile .px-msg')).toContainText('stop sent');
	await expect(row('pihole').locator('.dot.running')).toHaveCount(0, { timeout: 10_000 });

	await page.click('.px-widget');
	await expect(page.locator('.pop-title')).toHaveText('Lab');
	await expect(page.locator('.pop .px-guests li')).toHaveCount(3);
});

test('Portainer: stop a stack after confirming, start it again', async ({ page }) => {
	await setDashboard(page, [tile('pt', 'portainer', 0, 0, 5, 3)]);
	await page.goto('/');
	const webapp = page.locator('.pt-tile .pt-stacks li', { hasText: 'webapp' });
	await webapp.locator('button[title^="Stop"]').click();
	await expect(page.locator('.wm')).toContainText('Stop webapp?');
	await page.click('.wm-save');
	await expect(page.locator('.pt-tile .pt-msg')).toHaveText('webapp stopped');
	await webapp.locator('button[title^="Start"]').click();
	await expect(page.locator('.pt-tile .pt-msg')).toHaveText('webapp started');
});

test('Immich and Nextcloud show their data', async ({ page }) => {
	await setDashboard(page, [tile('im', 'immich', 0, 0, 5, 3), tile('nc', 'nextcloud', 5, 0, 5, 3, { showServer: true })]);
	await page.goto('/');
	await expect(page.locator('.im-tile .im-strip img')).toHaveCount(3);
	await expect.poll(() => page.locator('.im-tile .im-strip img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
	await expect(page.locator('.im-tile .im-stats')).toContainText('3photos');
	await expect(page.locator('.nc-tile .nc-files li a').first()).toContainText('budget.csv');
	await expect(page.locator('.nc-tile .nc-server')).toContainText('v31.0.1');
});

test('Settings > Integrations: toggle field and Test connection', async ({ page }) => {
	await page.goto('/');
	await openSettings(page);
	await page.click('.tab:has-text("Integrations")');
	await page.click('.ip-row:has-text("Proxmox")');
	const toggle = page.locator('.ip-detail label.toggle-switch', { hasText: 'Skip TLS' });
	await expect(toggle.locator('input')).toBeChecked();
	await page.click('button:has-text("Test connection")');
	await expect(page.locator('.ip-detail')).toContainText('Proxmox VE 8.2.4');
	await toggle.click();
	await page.click('button:has-text("Test connection")');
	await expect(page.locator('.ip-detail')).toContainText('TLS error');
});

test('Gitea shows repositories, open issues and pull requests', async ({ page }) => {
	await setDashboard(page, [tile('gt', 'gitea', 0, 0, 5, 4)]);
	await page.goto('/');
	const w = page.locator('.cb-item-gitea');
	await expect(w.getByText('ann/catboard')).toBeVisible();
	await expect(w.getByText('3 issues')).toBeVisible();
	await expect(w.getByText('1 PR')).toBeVisible();
	await expect(w.locator('a', { hasText: 'Add French' })).toHaveAttribute('href', 'https://git.example.com/ann/catboard/pulls/8');
});
