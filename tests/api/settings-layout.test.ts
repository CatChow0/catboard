import { describe, expect, it } from 'vitest';
import { client } from './helpers';

describe('settings', () => {
	it('are per user', async () => {
		const admin = await client('admin');
		const user = await client('user');
		const s = (await admin.get('/api/settings')).body;
		await admin.put('/api/settings', { ...s, theme: 'nord', title: 'Admin board' });
		expect((await admin.get('/api/settings')).body).toMatchObject({ theme: 'nord', title: 'Admin board' });
		expect((await user.get('/api/settings')).body.theme).toBe('dark');
	});

	it('keep the appearance fields, and cut custom CSS at 50 KB', async () => {
		const user = await client('user');
		const s = (await user.get('/api/settings')).body;
		const look = { theme: 'auto', autoDark: 'kanagawa', autoLight: 'github-light', radius: 6, accent: '#ff00aa', font: 'Inter', fontScale: 110, cardOpacity: 70, cardBlur: 6 };
		await user.put('/api/settings', { ...s, ...look, customCss: 'a{}'.repeat(20_000) });
		const saved = (await user.get('/api/settings')).body;
		expect(saved).toMatchObject(look);
		expect(saved.customCss).toHaveLength(50_000);
		await user.put('/api/settings', s);
	});

	it('fill in defaults for missing fields', async () => {
		const user = await client('user');
		const s = (await user.get('/api/settings')).body;
		await user.put('/api/settings', { theme: 'dracula' });
		const saved = (await user.get('/api/settings')).body;
		expect(saved.theme).toBe('dracula');
		expect(saved.layout.breakpoints.length).toBeGreaterThan(0);
		expect(saved.statusCheckInterval).toBe(30000);
		await user.put('/api/settings', s);
	});
});

describe('layout and dashboards', () => {
	it('every breakpoint of a new dashboard has a navbar title', async () => {
		const admin = await client('admin');
		const created = await admin.post('/api/layout/dashboards', { action: 'create', name: 'Ops' });
		expect(created.status).toBe(200);
		const list = (await admin.get('/api/layout')).body.dashboards;
		const ops = list.find((d: { name: string }) => d.name === 'Ops');
		expect(ops).toBeTruthy();
		const layout = (await admin.get(`/api/layout?dashboard=${ops.id}`)).body;
		expect(layout.dashboard).toBe(ops.id);
		for (const bp of Object.values(layout.layouts) as { navbar: { items: { type: string }[] } }[]) {
			expect(bp.navbar.items.filter((i) => i.type === 'navbar-title')).toHaveLength(1);
		}
	});

	it('saves one dashboard without touching the others', async () => {
		const admin = await client('admin');
		const main = (await admin.get('/api/layout?dashboard=main')).body;
		main.layouts.desktop.items = [{ id: 'clock-1', type: 'clock', col: 0, row: 0, colSpan: 2, rowSpan: 1 }];
		expect((await admin.put('/api/layout?dashboard=main', main)).status).toBe(200);
		const ops = (await admin.get('/api/layout')).body.dashboards.find((d: { name: string }) => d.name === 'Ops');
		expect((await admin.get(`/api/layout?dashboard=${ops.id}`)).body.layouts.desktop.items).toEqual([]);
		expect((await admin.get('/api/layout?dashboard=main')).body.layouts.desktop.items[0].id).toBe('clock-1');
	});

	it('refuses to write into a deleted dashboard', async () => {
		const admin = await client('admin');
		const main = (await admin.get('/api/layout?dashboard=main')).body;
		const res = await admin.put('/api/layout', { ...main, dashboard: 'gone' });
		expect(res.status).toBe(409);
	});
});

describe('export and import', () => {
	it('an export can be imported back', async () => {
		const admin = await client('admin');
		await admin.post('/api/services', { name: 'Grafana', url: 'http://127.0.0.1:9/grafana', statusCheck: { enabled: false, method: 'HEAD' } });
		const file = (await admin.get('/api/export')).body;
		expect(file).toMatchObject({ version: 1 });
		expect(file.services.services.some((s: { name: string }) => s.name === 'Grafana')).toBe(true);

		const services = file.services.services.filter((s: { name: string }) => s.name !== 'Grafana');
		await admin.post('/api/import', { sections: ['services'], services: { services } });
		expect((await admin.get('/api/services')).body.services.some((s: { name: string }) => s.name === 'Grafana')).toBe(false);
		const res = await admin.post('/api/import', { ...file, sections: ['services'] });
		expect(res.body.imported).toEqual(['services']);
		const after = (await admin.get('/api/services')).body.services;
		expect(after.some((s: { name: string }) => s.name === 'Grafana')).toBe(true);
		for (const s of after) await admin.del(`/api/services/${s.id}`);
	});
});
