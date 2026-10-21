// The widget routes as the widgets call them, against the fake services.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { client, type Client } from './helpers';
import { startAll, TOKENS, IMMICH_ASSETS } from '../mocks/services';

let mocks: Awaited<ReturnType<typeof startAll>>;
let admin: Client;
let user: Client;

beforeAll(async () => {
	mocks = await startAll();
	admin = await client('admin');
	user = await client('user');
	await admin.put('/api/integrations', {
		jenkins: { url: mocks.jenkins.url, ...TOKENS.jenkins, publicUrl: 'https://ci.example.com' },
		psitransfer: { url: mocks.psitransfer.url, publicUrl: 'https://share.example.com' },
		proxmox: { clusters: [{ id: 'c1', name: 'Lab', url: mocks.proxmox.url, ...TOKENS.proxmox, insecure: 'true' }] },
		portainer: { url: mocks.portainer.url, ...TOKENS.portainer, publicUrl: 'https://portainer.example.com' },
		immich: { url: mocks.immich.url, apiKey: TOKENS.immich.adminKey, publicUrl: 'https://photos.example.com' },
		nextcloud: { url: mocks.nextcloud.url, ...TOKENS.nextcloud, publicUrl: 'https://cloud.example.com' },
		gitea: { url: mocks.gitea.url, ...TOKENS.gitea, publicUrl: 'https://git.example.com' },
		deezer: { url: mocks.deezer.url, ...TOKENS.deezer }
	});
});
afterAll(async () => {
	await admin.put('/api/integrations', { jenkins: null, psitransfer: null, proxmox: null, portainer: null, immich: null, nextcloud: null, gitea: null, deezer: null });
	await mocks.close();
});

describe('Jenkins', () => {
	it('lists jobs, folders included', async () => {
		const res = await user.get('/api/integrations/jenkins/jobs');
		expect(res.body.jobs.map((j: { fullName: string }) => j.fullName)).toEqual(['hello', 'team/deploy']);
	});

	it('reads a job parameters and starts builds with them (admins only)', async () => {
		const params = (await user.get('/api/integrations/jenkins/params?job=team/deploy')).body.parameters;
		expect(params.map((p: { name: string; default: unknown }) => [p.name, p.default])).toEqual([['TARGET', 'prod-1'], ['ENV', 'production'], ['DRY_RUN', true]]);
		expect((await user.post('/api/integrations/jenkins/build', { job: 'team/deploy' })).status).toBe(403);
		const res = await admin.post('/api/integrations/jenkins/build', { job: 'team/deploy', params: { TARGET: 'srv-9', ENV: 'staging', DRY_RUN: false, bad: { x: 1 } } });
		expect(res.status).toBe(200);
		expect(mocks.jenkins.state.lastParams).toBe('TARGET=srv-9&ENV=staging&DRY_RUN=false');
		expect(mocks.jenkins.state.posts).toBe(1);
		expect((await admin.post('/api/integrations/jenkins/build', {})).status).toBe(400);
	});

	it('shows builds of one job or all, with public links', async () => {
		await admin.post('/api/integrations/jenkins/build', { job: 'hello' });
		const one = (await user.get('/api/integrations/jenkins/builds?job=team/deploy&limit=5')).body;
		expect(one).toMatchObject({ hasParameters: true, buildable: true });
		expect(one.jobUrl).toMatch(/^https:\/\/ci\.example\.com\/job\/team\/job\/deploy\/$/);
		const all = (await user.get('/api/integrations/jenkins/builds?limit=10')).body;
		expect(all.builds.map((b: { job: string }) => b.job).sort()).toEqual(['hello', 'team/deploy']);
		expect(all.builds.every((b: { url: string }) => b.url.startsWith('https://ci.example.com/'))).toBe(true);
	});
});

describe('Jenkins failing projects', () => {
	const failing = async () => ((await user.get('/api/integrations/jenkins/builds?limit=1')).body.failing as { job: string }[]).map((f) => f.job);

	it('a project is failing until a later build passes', async () => {
		expect(await failing()).toEqual([]);
		await admin.post('/api/integrations/jenkins/build', { job: 'hello', params: { FAIL: '1' } });
		expect(await failing()).toEqual(['hello']);
		await admin.post('/api/integrations/jenkins/build', { job: 'hello' });
		await admin.post('/api/integrations/jenkins/build', { job: 'hello' });
		expect(await failing()).toEqual([]);
	});
});

describe('PsiTransfer', () => {
	async function send(files: { name: string; data: Buffer }[], extra: Record<string, unknown> = {}, as = user) {
		const sid = randomBytes(6).toString('hex');
		const cfg = (await as.get('/api/integrations/psitransfer/config')).body;
		for (const f of files) {
			const c = await as.post('/api/integrations/psitransfer/upload', { sid, name: f.name, size: f.data.length, type: 'application/octet-stream', retention: '3600', ...extra });
			if (c.status !== 200) return { sid, error: c.body.error, status: c.status };
			for (let offset = 0; offset < f.data.length; ) {
				const r = await as.patch(`/api/integrations/psitransfer/upload/${c.body.id}`, new Uint8Array(f.data.subarray(offset, offset + cfg.chunkSize)), { 'upload-offset': String(offset), 'content-type': 'application/octet-stream' });
				if (r.status !== 200) return { sid, error: r.body.error, status: r.status };
				offset = r.body.offset;
			}
		}
		return { sid, url: (await as.post('/api/integrations/psitransfer/done', { sid })).body.url };
	}

	it('gives the retentions, chunk size and public link base', async () => {
		const cfg = (await user.get('/api/integrations/psitransfer/config')).body;
		expect(Object.keys(cfg.retentions)).toContain('one-time');
		expect(cfg.linkBase).toBe('https://share.example.com');
		expect(cfg.chunkSize).toBeLessThanOrEqual(512 * 1024);
	});

	it('any signed-in user can share several files, big ones in chunks, bytes intact', async () => {
		const files = [{ name: 'notes.txt', data: Buffer.from('hello\n') }, { name: 'big.bin', data: randomBytes(1_300_000) }, { name: 'dir/../évil?.png', data: randomBytes(1000) }];
		const res = await send(files);
		expect(res.url).toBe(`https://share.example.com/${res.sid}`);
		const got = mocks.psitransfer.files(res.sid);
		expect(Object.keys(got).sort()).toEqual(['big.bin', 'notes.txt', 'évil_.png']);
		expect(got['big.bin'].equals(files[1].data)).toBe(true);
		expect(mocks.psitransfer.locked.has(res.sid)).toBe(true);
	});

	it('passes the bucket password and refuses bad input', async () => {
		const res = await send([{ name: 'a.txt', data: Buffer.from('x') }], { password: 'pw123', retention: 'one-time' });
		expect(mocks.psitransfer.meta(res.sid)[0]).toMatchObject({ password: 'pw123', retention: 'one-time' });
		expect((await send([{ name: 'a', data: Buffer.from('x') }], { retention: '42' })).status).toBe(400);
		expect((await user.post('/api/integrations/psitransfer/upload', { sid: '../etc', name: 'x', size: 1, retention: '3600' })).status).toBe(400);
		expect((await user.patch('/api/integrations/psitransfer/upload/unknown-id', new Uint8Array(1), { 'upload-offset': '0', 'content-type': 'application/octet-stream' })).status).toBeGreaterThanOrEqual(400);
	});
});

describe('Proxmox', () => {
	it('lists nodes and guests (templates hidden)', async () => {
		const data = (await user.get('/api/integrations/proxmox/resources?cluster=c1')).body;
		expect(data.nodes.map((n: { node: string }) => n.node)).toEqual(['pve1', 'pve2']);
		expect(data.guests.map((g: { vmid: number }) => g.vmid)).toEqual([100, 101, 200]);
		expect((await user.get('/api/integrations/proxmox/resources?cluster=nope')).status).toBe(404);
	});

	it('starts and stops guests for admins, with input checks', async () => {
		const act = (body: object, as = admin) => as.post('/api/integrations/proxmox/action', { cluster: 'c1', ...body });
		expect((await act({ node: 'pve2', type: 'qemu', vmid: 101, action: 'start' }, user)).status).toBe(403);
		expect((await act({ node: 'pve2', type: 'qemu', vmid: 101, action: 'start' })).body.task).toMatch(/^UPID:/);
		expect(mocks.proxmox.guests.find((g) => g.vmid === 101)!.status).toBe('running');
		expect((await act({ node: 'pve1', type: 'lxc', vmid: 200, action: 'shutdown' })).status).toBe(200);
		expect((await act({ node: '../x', type: 'qemu', vmid: 1, action: 'start' })).status).toBe(400);
		expect((await act({ node: 'pve1', type: 'disk', vmid: 1, action: 'start' })).status).toBe(400);
		expect((await act({ node: 'pve1', type: 'qemu', vmid: 100, action: 'destroy' })).status).toBe(400);
	});
});

describe('Portainer', () => {
	it('lists environments and stacks, stops and starts a stack (admins only)', async () => {
		const o = (await user.get('/api/integrations/portainer/overview')).body;
		expect(o.endpoints[0]).toMatchObject({ name: 'dind', up: true, running: 2 });
		expect(o.url).toBe('https://portainer.example.com');
		const worker = o.stacks.find((s: { name: string }) => s.name === 'worker');
		expect((await user.post('/api/integrations/portainer/stack', { id: worker.id, endpointId: worker.endpointId, action: 'stop' })).status).toBe(403);
		expect((await admin.post('/api/integrations/portainer/stack', { id: worker.id, endpointId: worker.endpointId, action: 'stop' })).status).toBe(200);
		expect((await user.get('/api/integrations/portainer/overview')).body.stacks.find((s: { name: string }) => s.name === 'worker').active).toBe(false);
		const again = await admin.post('/api/integrations/portainer/stack', { id: worker.id, endpointId: worker.endpointId, action: 'stop' });
		expect(again).toMatchObject({ status: 502, body: { error: 'Stack is already inactive' } });
		expect((await admin.post('/api/integrations/portainer/stack', { id: worker.id, endpointId: worker.endpointId, action: 'start' })).status).toBe(200);
		expect((await admin.post('/api/integrations/portainer/stack', { id: 'x', endpointId: 2, action: 'remove' })).status).toBe(400);
	});
});

describe('Immich', () => {
	it('gives statistics and the latest photos', async () => {
		const data = (await user.get('/api/integrations/immich/summary?photos=2')).body;
		expect(data.stats).toEqual({ photos: 3, videos: 1, usage: 4096, scope: 'server' });
		expect(data.recent.map((p: { id: string }) => p.id)).toEqual(IMMICH_ASSETS.slice(0, 2));
		expect(data.url).toBe('https://photos.example.com');
	});

	it('proxies thumbnails with cache headers and refuses bad ids', async () => {
		const ok = await fetch(`${(await import('./helpers')).baseUrl()}/api/integrations/immich/thumb/${IMMICH_ASSETS[0]}`, { headers: { cookie: user.cookie } });
		expect(ok.status).toBe(200);
		expect(ok.headers.get('content-type')).toBe('image/png');
		expect(ok.headers.get('cache-control')).toMatch(/max-age=\d+/);
		expect((await user.get('/api/integrations/immich/thumb/not-a-uuid')).status).toBe(400);
		expect((await user.get('/api/integrations/immich/thumb/99999999-9999-4999-8999-999999999999')).status).toBe(404);
	});
});

describe('Nextcloud', () => {
	it('gives quota, server info and recent files with public links', async () => {
		const data = (await user.get('/api/integrations/nextcloud/overview?server=1&files=5')).body;
		expect(data.user).toEqual({ name: 'Ann', used: 65646189, total: 1e9 });
		expect(data.server).toMatchObject({ version: '31.0.1', files: 1234, activeUsers: 2 });
		expect(data.files.map((f: { name: string }) => f.name)).toEqual(['budget.csv', 'notes & ideas.md', 'q3 summary.txt']);
		expect(data.files[0]).toMatchObject({ path: '/Reports/budget.csv', url: 'https://cloud.example.com/f/81' });
	});

	it('only asks for what the widget shows', async () => {
		const data = (await user.get('/api/integrations/nextcloud/overview?server=0&files=0')).body;
		expect(data.server).toBeNull();
		expect(data.files).toEqual([]);
	});
});

describe('Gitea / Forgejo', () => {
	it('gives the recent repositories and the open issues and pull requests', async () => {
		const data = (await user.get('/api/integrations/gitea/overview?repos=2&issues=3')).body;
		expect(data).toMatchObject({ user: 'Ann', url: 'https://git.example.com', counts: { issues: 3, pulls: 1 } });
		expect(data.repos.map((r: { name: string }) => r.name)).toEqual(['ann/catboard', 'homelab/infra']);
		expect(data.repos[1]).toMatchObject({ private: true, issues: 1, url: 'https://git.example.com/homelab/infra' });
		expect(data.open.map((i: { number: number; pull: boolean }) => [i.number, i.pull])).toEqual([[8, true], [7, false], [3, false]]);
	});

	it('only asks for what the widget shows', async () => {
		const data = (await user.get('/api/integrations/gitea/overview?repos=0&issues=0')).body;
		expect(data).toMatchObject({ repos: [], open: [], counts: null });
	});
});

describe('Deezer to Navidrome releases', () => {
	it('new releases: past only, muted and features out, library status', async () => {
		const data = (await user.get('/api/integrations/arr/releases?sources=deezer&days=30&limit=10')).body;
		expect(data.entries.map((e: { subtitle: string; hasFile: boolean; kind: string }) => [e.subtitle, e.hasFile, e.kind])).toEqual([['Owned Album', true, 'album']]);
		const withFeatures = (await user.get('/api/integrations/arr/releases?sources=deezer&days=30&includeFeatures=true')).body;
		expect(withFeatures.entries.map((e: { subtitle: string }) => e.subtitle)).toEqual(['Owned Album', 'Guest Spot']);
		const owned = (await user.get('/api/integrations/arr/releases?sources=deezer&days=30&includeFeatures=true&onlyDownloaded=true')).body;
		expect(owned.entries.map((e: { subtitle: string }) => e.subtitle)).toEqual(['Owned Album']);
	});

	it('calendar: upcoming releases too', async () => {
		const day = (n: number) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
		const data = (await user.get(`/api/integrations/arr/calendar?sources=deezer&start=${day(-10)}&end=${day(10)}`)).body;
		expect(data.entries.map((e: { subtitle: string; type: string }) => [e.subtitle, e.type])).toEqual([['Owned Album', 'deezer'], ['Next Single', 'deezer']]);
	});
});

describe('Deezer to Navidrome webhook', () => {
	const releasesOf = async () => (await user.get('/api/integrations/arr/releases?sources=deezer&days=30')).body.entries.map((e: { subtitle: string }) => e.subtitle);

	it('a secret is made with the connection, kept on save, hidden from users', async () => {
		const token = (await admin.get('/api/integrations')).body.deezer.webhookToken;
		expect(token).toMatch(/^[\w-]{20,}$/);
		await admin.put('/api/integrations', { deezer: { url: mocks.deezer.url, ...TOKENS.deezer, webhookToken: token } });
		expect((await admin.get('/api/integrations')).body.deezer.webhookToken).toBe(token);
		expect((await user.get('/api/integrations')).body.deezer.webhookToken).toBe('');
		expect((await user.post('/api/integrations/deezer/webhook-token')).status).toBe(403);
	});

	it('refuses a wrong token, needs no session', async () => {
		const anon = await client('anon');
		expect((await anon.post('/api/integrations/deezer/webhook?token=nope', { event: 'releases.updated' })).status).toBe(401);
		expect((await anon.post('/api/integrations/deezer/webhook', { event: 'releases.updated' })).status).toBe(401);
		const token = (await admin.get('/api/integrations')).body.deezer.webhookToken;
		expect((await anon.post(`/api/integrations/deezer/webhook?token=${token}`, { event: 'test' })).status).toBe(200);
	});

	it('the feed stays cached until the webhook says it changed', async () => {
		const token = (await admin.get('/api/integrations')).body.deezer.webhookToken;
		const anon = await client('anon');
		await anon.post(`/api/integrations/deezer/webhook?token=${token}`, { event: 'releases.updated' });
		expect(await releasesOf()).toEqual(['Owned Album']);
		mocks.deezer.addRelease('Fresh Album');
		expect(await releasesOf()).toEqual(['Owned Album']);
		await anon.post(`/api/integrations/deezer/webhook?token=${token}`, { event: 'releases.updated' });
		expect(await releasesOf()).toEqual(['Fresh Album', 'Owned Album']);
	});

	it('a new secret replaces the old URL', async () => {
		const old = (await admin.get('/api/integrations')).body.deezer.webhookToken;
		const fresh = (await admin.post('/api/integrations/deezer/webhook-token')).body.webhookToken;
		expect(fresh).not.toBe(old);
		const anon = await client('anon');
		expect((await anon.post(`/api/integrations/deezer/webhook?token=${old}`, { event: 'test' })).status).toBe(401);
		expect((await anon.post(`/api/integrations/deezer/webhook?token=${fresh}`, { event: 'test' })).status).toBe(200);
	});
});

describe('not set up', () => {
	it('answers 404 with a clear message', async () => {
		await admin.put('/api/integrations', { portainer: null });
		const res = await user.get('/api/integrations/portainer/overview');
		expect(res).toMatchObject({ status: 404, body: { error: 'Portainer is not set up' } });
		await admin.put('/api/integrations', { portainer: { url: mocks.portainer.url, ...TOKENS.portainer } });
	});
});
