// Who may do what: admin-only actions, the "who can edit dashboards" setting,
// and the login attempt limit.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, login, type Client } from './helpers';

let admin: Client;
let user: Client;

beforeAll(async () => {
	admin = await client('admin');
	user = await client('user');
});
afterAll(async () => {
	await admin.put('/api/access', { dashboardEditors: 'admins' });
});

describe('admin-only actions', () => {
	it('pausing AdGuard Home and the icon cache need an admin', async () => {
		expect((await user.post('/api/integrations/adguard-home/protection', { enabled: false })).status).toBe(403);
		expect((await user.del('/api/cache')).status).toBe(403);
		expect((await user.post('/api/cache')).status).toBe(403);
		expect((await admin.del('/api/cache')).status).toBe(200);
		// Reading the cache stats stays open.
		expect((await user.get('/api/cache')).status).toBe(200);
	});

	it('the access setting itself is for admins', async () => {
		expect((await user.get('/api/access')).status).toBe(403);
		expect((await user.put('/api/access', { dashboardEditors: 'everyone' })).status).toBe(403);
		expect((await admin.put('/api/access', { dashboardEditors: 'root' })).status).toBe(400);
	});
});

describe('who can edit dashboards', () => {
	const writes = async (c: Client) => {
		const created = await c.post('/api/services', { name: 'Perm test', url: 'http://127.0.0.1:9/x', statusCheck: { enabled: false, method: 'HEAD' } });
		const layout = (await admin.get('/api/layout?dashboard=main')).body;
		return {
			create: created.status,
			id: created.body?.id as string | undefined,
			layout: (await c.put('/api/layout?dashboard=main', layout)).status,
			dashboards: (await c.post('/api/layout/dashboards', { action: 'rename', id: 'main', name: 'Home' })).status,
			upload: (await c.post('/api/icons/upload', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), { 'content-type': 'image/png' })).status
		};
	};

	it('new installs start with admins only', async () => {
		expect((await admin.get('/api/access')).body).toEqual({ dashboardEditors: 'admins' });
		expect((await user.get('/api/auth/check')).body.canEdit).toBe(false);
		expect((await admin.get('/api/auth/check')).body.canEdit).toBe(true);
	});

	it('with "admins", a user cannot change services, layout, dashboards or icons', async () => {
		const r = await writes(user);
		expect(r).toMatchObject({ create: 403, layout: 403, dashboards: 403, upload: 403 });
		const id = (await admin.get('/api/services')).body.services[0]?.id;
		if (id) {
			expect((await user.put(`/api/services/${id}`, { name: 'x' })).status).toBe(403);
			expect((await user.del(`/api/services/${id}`)).status).toBe(403);
		}
		// Their own settings stay theirs.
		const s = (await user.get('/api/settings')).body;
		expect((await user.put('/api/settings', { ...s, theme: 'nord' })).status).toBe(200);
		await user.put('/api/settings', s);
	});

	it('admins can always edit', async () => {
		const r = await writes(admin);
		expect(r).toMatchObject({ create: 201, layout: 200, dashboards: 200 });
		await admin.del(`/api/services/${r.id}`);
	});

	it('with "everyone", users can edit too', async () => {
		expect((await admin.put('/api/access', { dashboardEditors: 'everyone' })).status).toBe(200);
		expect((await user.get('/api/auth/check')).body.canEdit).toBe(true);
		const r = await writes(user);
		expect(r).toMatchObject({ create: 201, layout: 200, dashboards: 200 });
		expect((await user.del(`/api/services/${r.id}`)).status).toBe(200);
		await admin.put('/api/access', { dashboardEditors: 'admins' });
	});
});

describe('login attempt limit', () => {
	it('blocks an account after 5 failures, then lets it in after the wait', async () => {
		await admin.post('/api/users', { username: 'locked', password: 'locked-pass', role: 'user' });
		for (let i = 0; i < 5; i++) expect((await login('locked', 'wrong')).status).toBe(401);
		const res = await fetch(`${(await import('./helpers')).baseUrl()}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'locked', password: 'locked-pass' }) });
		expect(res.status).toBe(429);
		expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
		expect((await res.json()).error).toMatch(/Too many attempts/);
		// The test server blocks for 1 s instead of 30 s.
		await new Promise((r) => setTimeout(r, 1200));
		expect((await login('locked', 'locked-pass')).status).toBe(200);
		// Other accounts were never blocked.
		expect((await login('viewer', 'viewer-pass-123')).status).toBe(200);
		await admin.del('/api/users/locked');
	});

	it('the username is matched without case', async () => {
		await admin.post('/api/users', { username: 'casey', password: 'casey-pass', role: 'user' });
		for (let i = 0; i < 5; i++) await login(i % 2 ? 'CASEY' : 'casey', 'wrong');
		expect((await login('casey', 'casey-pass')).status).toBe(429);
		await new Promise((r) => setTimeout(r, 1200));
		await admin.del('/api/users/casey');
	});
});
