import { describe, expect, it } from 'vitest';
import { baseUrl, client, login } from './helpers';
import { ADMIN, USER } from './setup';

describe('setup and login', () => {
	it('setup only works once', async () => {
		const anon = await client('anon');
		const res = await anon.post('/api/auth/setup', { username: 'x', password: 'xxxxxxxx' });
		expect(res.status).toBe(400);
		expect(res.body.error).toBe('Setup already completed');
	});

	it('logs in with the right password only', async () => {
		expect((await login(ADMIN.username, ADMIN.password)).status).toBe(200);
		expect((await login(ADMIN.username, 'wrong')).status).toBe(401);
		expect((await login('nobody', 'whatever')).status).toBe(401);
	});

	it('reports the session and role', async () => {
		const user = await client('user');
		expect((await user.get('/api/auth/check')).body).toMatchObject({ authenticated: true, needsSetup: false, username: USER.username, role: 'user' });
		const anon = await client('anon');
		expect((await anon.get('/api/auth/check')).body).toMatchObject({ authenticated: false });
	});

	it('logout ends the session', async () => {
		const c = await client('user');
		await c.post('/api/auth/logout');
		expect((await c.get('/api/settings')).status).toBe(401);
	});
});

describe('protected routes', () => {
	it.each(['/api/settings', '/api/layout', '/api/services', '/api/integrations', '/api/status'])('%s needs a session', async (path) => {
		const anon = await client('anon');
		expect((await anon.get(path)).status).toBe(401);
	});

	it('pages redirect to the login page', async () => {
		const res = await fetch(baseUrl() + '/', { redirect: 'manual' });
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('/login');
	});

	it('admin-only routes refuse a plain user', async () => {
		const user = await client('user');
		expect((await user.put('/api/integrations', { spoolman: { url: 'http://x' } })).status).toBe(403);
		expect((await user.post('/api/integrations/test', { key: 'spoolman', value: { url: 'http://x' } })).status).toBe(403);
		expect((await user.post('/api/users', { username: 'x', password: 'xxxxxxx', role: 'admin' })).status).toBe(403);
		expect((await user.get('/api/export')).status).toBe(401);
		expect((await user.post('/api/import', { sections: ['settings'], settings: {} })).status).toBe(401);
		for (const path of ['/api/integrations/jenkins/build', '/api/integrations/proxmox/action', '/api/integrations/portainer/stack', '/api/integrations/qbittorrent/action', '/api/integrations/elegoo/action']) {
			expect((await user.post(path, {})).status, path).toBe(403);
		}
	});
});

describe('users', () => {
	it('an admin creates and deletes users; usernames are unique', async () => {
		const admin = await client('admin');
		expect((await admin.post('/api/users', { username: 'temp', password: 'temp-pass', role: 'user' })).status).toBe(201);
		expect((await admin.post('/api/users', { username: 'temp', password: 'temp-pass', role: 'user' })).status).toBe(409);
		expect((await admin.post('/api/users', { username: 'bad', password: 'x', role: 'user' })).status).toBe(400);
		expect((await admin.post('/api/users', { username: 'bad', password: 'long-enough', role: 'root' })).status).toBe(400);
		expect((await login('temp', 'temp-pass')).status).toBe(200);
		expect((await admin.del('/api/users/temp')).status).toBe(200);
		expect((await login('temp', 'temp-pass')).status).toBe(401);
	});
});
