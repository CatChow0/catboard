import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, type Client } from './helpers';
import { statusTarget } from '../mocks/services';

let target: Awaited<ReturnType<typeof statusTarget>>;
let admin: Client;
const ids: string[] = [];

beforeAll(async () => {
	target = await statusTarget();
	admin = await client('admin');
	for (let i = 0; i < 12; i++) {
		const path = i === 11 ? '/down/x' : `/svc${i}`;
		ids.push((await admin.post('/api/services', { name: `svc${i}`, url: target.url + path, statusCheck: { enabled: true, method: 'HEAD' } })).body.id);
	}
	ids.push((await admin.post('/api/services', { name: 'unchecked', url: target.url + '/never', statusCheck: { enabled: false, method: 'HEAD' } })).body.id);
	const s = (await admin.get('/api/settings')).body;
	await admin.put('/api/settings', { ...s, statusCheckInterval: 10000 });
});

afterAll(async () => {
	for (const id of ids) await admin.del(`/api/services/${id}`);
	await target.close();
});

describe('service status', () => {
	it('concurrent viewers share one check per service', async () => {
		const user = await client('user');
		const [a, b] = await Promise.all([admin.get('/api/status'), user.get('/api/status')]);
		expect(b.body).toEqual(a.body);
		expect(a.body[ids[0]]).toBe('online');
		expect(a.body[ids[11]]).toBe('error');
		expect(a.body[ids[12]]).toBeUndefined();
		const probes = Object.entries(target.hits);
		expect(probes).toHaveLength(12);
		expect(probes.every(([, n]) => n === 1)).toBe(true);
	});

	it('probes in parallel, a few at a time', async () => {
		// 12 probes of 150 ms: sequential would take 1.8 s.
		await new Promise((r) => setTimeout(r, 10_500));
		const t0 = Date.now();
		await admin.get('/api/status');
		expect(Date.now() - t0).toBeLessThan(1200);
	});

	it('keeps results for the check interval', async () => {
		const before = target.hits['/svc0'];
		await admin.get('/api/status');
		expect(target.hits['/svc0']).toBe(before);
	});
});
