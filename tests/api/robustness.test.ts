// Health check, config backups and restore, recovery of a corrupt file,
// concurrent saves.
import { describe, expect, inject, it } from 'vitest';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { baseUrl, client } from './helpers';

const configDir = () => inject('configDir');

describe('health', () => {
	it('answers without a session', async () => {
		const res = await fetch(baseUrl() + '/api/health');
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ status: 'ok' });
	});
});

describe('backups', () => {
	it('are for the admin only', async () => {
		const user = await client('user');
		expect((await user.get('/api/backups')).status).toBe(403);
		expect((await user.post('/api/backups')).status).toBe(403);
	});

	it('a daily backup exists once the config has changed', async () => {
		const admin = await client('admin');
		await admin.post('/api/services', { name: 'Daily trigger', url: 'http://127.0.0.1:9/d', statusCheck: { enabled: false, method: 'HEAD' } });
		const list = (await admin.get('/api/backups')).body.backups as { reason: string; files: string[] }[];
		const daily = list.find((b) => b.reason === 'daily');
		expect(daily).toBeTruthy();
		expect(daily!.files).toContain('users.json');
		expect(daily!.files).not.toContain('sessions.json');
	});

	it('restore brings back an earlier config and keeps the current one as a backup', async () => {
		const admin = await client('admin');
		const made = await admin.post('/api/backups');
		expect(made.status).toBe(201);
		const before = (await admin.get('/api/services')).body.services.length;

		const added = (await admin.post('/api/services', { name: 'Added after backup', url: 'http://127.0.0.1:9/a', statusCheck: { enabled: false, method: 'HEAD' } })).body;
		expect((await admin.get('/api/services')).body.services).toHaveLength(before + 1);

		const res = await admin.post(`/api/backups/${made.body.id}/restore`);
		expect(res.status).toBe(200);
		expect(res.body.restored).toContain('services.json');
		const after = (await admin.get('/api/services')).body.services as { id: string }[];
		expect(after).toHaveLength(before);
		expect(after.some((s) => s.id === added.id)).toBe(false);

		const list = (await admin.get('/api/backups')).body.backups as { reason: string }[];
		expect(list[0].reason).toBe('before-restore');
		// Sessions were not touched: still signed in.
		expect((await admin.get('/api/auth/check')).body.authenticated).toBe(true);
	});

	it('a backup downloads as one JSON file, unknown ids are refused', async () => {
		const admin = await client('admin');
		const id = (await admin.get('/api/backups')).body.backups[0].id;
		const res = await fetch(`${baseUrl()}/api/backups/${id}`, { headers: { cookie: admin.cookie } });
		expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="catboard-backup-.*\.json"/);
		const bundle = await res.json();
		expect(bundle).toMatchObject({ catboardBackup: 1, id });
		expect(Object.keys(bundle.files)).toContain('services.json');
		expect((await admin.get('/api/backups/nope')).status).toBe(404);
		expect((await admin.post('/api/backups/..%2F..%2Fetc/restore')).status).toBe(404);
	});

	it('an import makes a backup first', async () => {
		const admin = await client('admin');
		const services = (await admin.get('/api/services')).body;
		await admin.post('/api/import', { sections: ['services'], services });
		const list = (await admin.get('/api/backups')).body.backups as { reason: string }[];
		expect(list[0].reason).toBe('before-import');
	});
});

describe('corrupt config file', () => {
	it('is moved aside and replaced by its latest backup', async () => {
		const admin = await client('admin');
		await admin.post('/api/backups');
		const good = (await admin.get('/api/services')).body.services as unknown[];
		await writeFile(join(configDir(), 'services.json'), '{"services": [ {"id": "half');
		const res = await admin.get('/api/services');
		expect(res.status).toBe(200);
		expect(res.body.services).toHaveLength(good.length);
		const names = await readdir(configDir());
		expect(names.some((n) => n.startsWith('services.json.corrupt-'))).toBe(true);
	});
});

describe('concurrent saves', () => {
	it('ten services added at once are all kept, the file stays valid', async () => {
		const admin = await client('admin');
		const before = (await admin.get('/api/services')).body.services.length;
		const results = await Promise.all(
			Array.from({ length: 10 }, (_, i) => admin.post('/api/services', { name: `Burst ${i}`, url: `http://127.0.0.1:9/${i}`, statusCheck: { enabled: false, method: 'HEAD' } }))
		);
		expect(results.every((r) => r.status === 201)).toBe(true);
		const after = (await admin.get('/api/services')).body.services as { name: string; id: string }[];
		expect(after).toHaveLength(before + 10);
		JSON.parse(await readFile(join(configDir(), 'services.json'), 'utf-8'));
		for (const s of after.filter((x) => x.name.startsWith('Burst '))) await admin.del(`/api/services/${s.id}`);
	});
});
