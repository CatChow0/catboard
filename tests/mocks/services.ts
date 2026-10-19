// Fake external services for the API and E2E tests: just enough of each API
// for CatBoard's routes, with state (builds, guests, stacks) and a request log.
// Every server listens on 127.0.0.1; ports are random unless given.
import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

export const TOKENS = {
	jenkins: { username: 'ci', apiToken: 'jenkins-token' },
	psitransfer: { uploadPassword: 'up-pass' },
	proxmox: { tokenId: 'catboard@pve!dash', tokenSecret: '11111111-2222-3333-4444-555555555555' },
	portainer: { apiKey: 'ptr_test' },
	immich: { adminKey: 'immich-admin', userKey: 'immich-user' },
	nextcloud: { username: 'ann', appPassword: 'nc-app-pass' },
	gitea: { apiToken: 'gitea-token' }
};

type Req = http.IncomingMessage & { body: Buffer };
type Handler = (req: Req, res: http.ServerResponse, url: URL) => void | Promise<void>;
export interface Mock {
	url: string;
	log: { method: string; path: string }[];
	close: () => Promise<void>;
}

const send = (res: http.ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) => {
	const text = body === undefined ? '' : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
	res.writeHead(status, { ...(typeof body === 'object' && !Buffer.isBuffer(body) ? { 'content-type': 'application/json' } : {}), ...headers });
	res.end(text);
};

async function serve(handler: Handler, opts: { port?: number; tls?: boolean } = {}): Promise<Mock> {
	const log: Mock['log'] = [];
	const listener = (req: http.IncomingMessage, res: http.ServerResponse) => {
		const chunks: Buffer[] = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', async () => {
			const r = Object.assign(req, { body: Buffer.concat(chunks) });
			const url = new URL(req.url ?? '/', 'http://mock');
			log.push({ method: req.method ?? 'GET', path: url.pathname + url.search });
			try {
				await handler(r, res, url);
			} catch (e) {
				send(res, 500, { error: String(e) });
			}
		});
	};
	const certs = fileURLToPath(new URL('./certs/', import.meta.url));
	const server = opts.tls
		? https.createServer({ key: readFileSync(certs + 'test-key.pem'), cert: readFileSync(certs + 'test-cert.pem') }, listener)
		: http.createServer(listener);
	await new Promise<void>((resolve) => server.listen(opts.port ?? 0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	return {
		url: `${opts.tls ? 'https' : 'http'}://127.0.0.1:${port}`,
		log,
		close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); })
	};
}

const basic = (req: http.IncomingMessage) => {
	const h = req.headers.authorization ?? '';
	return h.startsWith('Basic ') ? Buffer.from(h.slice(6), 'base64').toString() : '';
};

// --- Jenkins ------------------------------------------------------------------
export function jenkinsMock(port?: number) {
	const state = { builds: { hello: [] as object[], 'team/deploy': [] as object[] }, lastParams: '' as string, posts: 0 };
	const build = (job: string, n: number, base: string) => ({ number: n, result: 'SUCCESS', building: false, timestamp: Date.now() - (10 - n) * 60000, duration: 4000, estimatedDuration: 4000, url: `${base}/job/${job.replace('/', '/job/')}/${n}/` });
	let base = '';
	const job = (name: string, full: string) => ({ _class: 'hudson.model.FreeStyleProject', name, fullName: full, color: 'blue', url: `${base}/job/${full.replace('/', '/job/')}/`, builds: (state.builds as Record<string, object[]>)[full] });
	return serve((req, res, url) => {
		res.setHeader('X-Jenkins', '2.479.1');
		if (basic(req) !== `${TOKENS.jenkins.username}:${TOKENS.jenkins.apiToken}`) return send(res, 401, 'Unauthorized');
		const p = url.pathname;
		if (p === '/api/json') return send(res, 200, { mode: 'NORMAL', jobs: [job('hello', 'hello'), { _class: 'com.cloudbees.hudson.plugins.folder.Folder', name: 'team', fullName: 'team', jobs: [job('deploy', 'team/deploy')] }] });
		const m = p.match(/^\/job\/(.+?)\/(api\/json|build|buildWithParameters)$/);
		if (!m) return send(res, 404, 'Not found');
		const name = m[1].split('/job/').join('/');
		const list = (state.builds as Record<string, object[]>)[name];
		if (!list) return send(res, 404, 'Not found');
		if (m[2] === 'api/json') {
			if (url.searchParams.get('tree')?.includes('choices')) {
				return send(res, 200, { property: name === 'team/deploy' ? [{ parameterDefinitions: [
					{ name: 'TARGET', type: 'StringParameterDefinition', defaultParameterValue: { value: 'prod-1' } },
					{ name: 'ENV', type: 'ChoiceParameterDefinition', choices: ['production', 'staging'], defaultParameterValue: { value: 'production' } },
					{ name: 'DRY_RUN', type: 'BooleanParameterDefinition', defaultParameterValue: { value: true } }
				] }] : [] });
			}
			return send(res, 200, { ...job(name.split('/').pop()!, name), buildable: true, inQueue: false, property: name === 'team/deploy' ? [{ parameterDefinitions: [{ name: 'TARGET' }] }] : [], builds: [...list].reverse() });
		}
		if (req.method !== 'POST') return send(res, 405, '');
		state.posts++;
		state.lastParams = req.body.toString();
		// A FAIL=1 parameter makes the build fail (to test failing projects).
		list.push({ ...build(name, list.length + 1, base), ...(/(^|&)FAIL=1(&|$)/.test(state.lastParams) ? { result: 'FAILURE' } : {}) });
		return send(res, 201, '', { Location: `${base}/queue/item/1/` });
	}, { port }).then((m) => {
		base = m.url;
		return Object.assign(m, { state });
	});
}

// --- PsiTransfer --------------------------------------------------------------
export function psitransferMock(port?: number, opts: { uploadPassword?: string } = {}) {
	const uploads = new Map<string, { length: number; data: Buffer[]; meta: Record<string, string> }>();
	const locked = new Set<string>();
	let n = 0;
	return serve((req, res, url) => {
		if (opts.uploadPassword && req.headers['x-passwd'] !== opts.uploadPassword) return send(res, req.headers['x-passwd'] ? 403 : 401, { message: 'Upload password' });
		if (url.pathname === '/config.json') return send(res, 200, { retentions: { 'one-time': 'one-time', '3600': '1 hour', '86400': '1 day' }, defaultRetention: '3600', requireBucketPassword: false, maxFileSize: null, maxBucketSize: null });
		if (url.pathname === '/files' && req.method === 'POST') {
			const meta = Object.fromEntries(String(req.headers['upload-metadata'] ?? '').split(',').filter(Boolean).map((p) => {
				const [k, v] = p.split(' ');
				return [k, Buffer.from(v ?? '', 'base64').toString()];
			}));
			const id = `${meta.sid}++${(++n).toString(16)}`;
			uploads.set(id, { length: Number(req.headers['upload-length']), data: [], meta });
			// Absolute location with the server's own host name, like PsiTransfer does.
			return send(res, 201, '', { Location: `http://psitransfer.internal/files/${id}` });
		}
		const m = url.pathname.match(/^\/files\/([^/]+)$/);
		if (m && req.method === 'PATCH') {
			if (url.searchParams.get('lock') === 'yes') {
				locked.add(m[1]);
				return send(res, 204);
			}
			const u = uploads.get(decodeURIComponent(m[1]));
			if (!u) return send(res, 404);
			const offset = u.data.reduce((a, b) => a + b.length, 0);
			if (Number(req.headers['upload-offset']) !== offset) return send(res, 409);
			u.data.push(req.body);
			return send(res, 204, undefined, { 'Upload-Offset': String(offset + req.body.length) });
		}
		return send(res, 404);
	}, { port }).then((m) => Object.assign(m, {
		/** Files received for a bucket: name -> bytes. */
		files: (sid: string) => Object.fromEntries([...uploads.values()].filter((u) => u.meta.sid === sid).map((u) => [u.meta.name, Buffer.concat(u.data)])),
		meta: (sid: string) => [...uploads.values()].filter((u) => u.meta.sid === sid).map((u) => u.meta),
		locked
	}));
}

// --- Proxmox (HTTPS, self-signed) ----------------------------------------------
export function proxmoxMock(port?: number) {
	const guests = [
		{ type: 'qemu', vmid: 100, name: 'home-assistant', node: 'pve1', status: 'running', cpu: 0.12, maxcpu: 2, mem: 2.1e9, maxmem: 4e9, uptime: 86400 },
		{ type: 'qemu', vmid: 101, name: 'windows-11', node: 'pve2', status: 'stopped', cpu: 0, maxcpu: 4, mem: 0, maxmem: 8e9, uptime: 0 },
		{ type: 'lxc', vmid: 200, name: 'pihole', node: 'pve1', status: 'running', cpu: 0.02, maxcpu: 1, mem: 1.5e8, maxmem: 5e8, uptime: 3600 },
		{ type: 'qemu', vmid: 9000, name: 'debian-template', node: 'pve1', status: 'stopped', template: 1, cpu: 0, maxcpu: 1, mem: 0, maxmem: 1e9, uptime: 0 }
	];
	const nodes = [
		{ type: 'node', node: 'pve1', status: 'online', cpu: 0.23, maxcpu: 8, mem: 12e9, maxmem: 32e9, uptime: 999999 },
		{ type: 'node', node: 'pve2', status: 'online', cpu: 0.61, maxcpu: 12, mem: 40e9, maxmem: 64e9, uptime: 555555 }
	];
	const token = `PVEAPIToken=${TOKENS.proxmox.tokenId}=${TOKENS.proxmox.tokenSecret}`;
	return serve((req, res, url) => {
		if (req.headers.authorization !== token) return send(res, 401, { data: null });
		const p = url.pathname.replace(/^\/api2\/json/, '');
		if (p === '/version') return send(res, 200, { data: { version: '8.2.4', release: '8.2' } });
		if (p === '/cluster/resources') return send(res, 200, { data: [...nodes, ...guests] });
		const m = p.match(/^\/nodes\/([\w.-]+)\/(qemu|lxc)\/(\d+)\/status\/(start|shutdown|reboot|stop)$/);
		if (m && req.method === 'POST') {
			const g = guests.find((x) => x.node === m[1] && x.type === m[2] && x.vmid === Number(m[3]));
			if (!g) return send(res, 500, { data: null });
			g.status = m[4] === 'start' || m[4] === 'reboot' ? 'running' : 'stopped';
			return send(res, 200, { data: `UPID:${m[1]}:${m[4]}:${m[3]}` });
		}
		return send(res, 501, { data: null });
	}, { port, tls: true }).then((m) => Object.assign(m, { guests }));
}

// --- Portainer ----------------------------------------------------------------
export function portainerMock(port?: number) {
	const stacks = [
		{ Id: 1, Name: 'webapp', EndpointId: 2, Status: 1, Type: 2 },
		{ Id: 2, Name: 'worker', EndpointId: 2, Status: 1, Type: 2 }
	];
	return serve((req, res, url) => {
		if (url.pathname === '/api/system/status') return send(res, 200, { Version: '2.33.7' });
		if (req.headers['x-api-key'] !== TOKENS.portainer.apiKey) return send(res, 401, { message: 'Unauthorized' });
		if (url.pathname === '/api/endpoints') return send(res, 200, [{ Id: 2, Name: 'dind', Status: 1, Snapshots: [{ RunningContainerCount: stacks.filter((s) => s.Status === 1).length, StoppedContainerCount: stacks.filter((s) => s.Status !== 1).length, HealthyContainerCount: 0, UnhealthyContainerCount: 0 }] }]);
		if (url.pathname === '/api/stacks') return send(res, 200, stacks);
		const m = url.pathname.match(/^\/api\/stacks\/(\d+)\/(start|stop)$/);
		if (m && req.method === 'POST') {
			const s = stacks.find((x) => x.Id === Number(m[1]) && x.EndpointId === Number(url.searchParams.get('endpointId')));
			if (!s) return send(res, 404, { message: 'Not found' });
			const want = m[2] === 'start' ? 1 : 2;
			if (s.Status === want) return send(res, 400, { message: 'Bad request', details: `Stack is already ${want === 1 ? 'active' : 'inactive'}` });
			s.Status = want;
			return send(res, 200, s);
		}
		return send(res, 404, { message: 'Not found' });
	}, { port }).then((m) => Object.assign(m, { stacks }));
}

// --- Immich -------------------------------------------------------------------
// 1x1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
export const IMMICH_ASSETS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];

export function immichMock(port?: number) {
	return serve((req, res, url) => {
		if (url.pathname === '/api/server/version') return send(res, 200, { major: 3, minor: 3, patch: 3 });
		const key = req.headers['x-api-key'];
		const admin = key === TOKENS.immich.adminKey;
		if (!admin && key !== TOKENS.immich.userKey) return send(res, 401, { message: 'Invalid API key' });
		if (url.pathname === '/api/users/me') return send(res, 200, { name: admin ? 'Admin' : 'User', email: 'x@y', isAdmin: admin });
		if (url.pathname === '/api/server/statistics') return admin ? send(res, 200, { photos: 3, videos: 1, usage: 4096 }) : send(res, 403, { message: 'Forbidden' });
		if (url.pathname === '/api/assets/statistics') return send(res, 200, { images: 0, videos: 0, total: 0 });
		if (url.pathname === '/api/search/metadata' && req.method === 'POST') {
			const size = JSON.parse(req.body.toString() || '{}').size ?? 10;
			return send(res, 200, { assets: { items: (admin ? IMMICH_ASSETS : []).slice(0, size).map((id, i) => ({ id, fileCreatedAt: new Date(Date.now() - i * 3600e3).toISOString() })) } });
		}
		const m = url.pathname.match(/^\/api\/assets\/([\w-]+)\/thumbnail$/);
		if (m) return IMMICH_ASSETS.includes(m[1]) ? send(res, 200, PNG, { 'content-type': 'image/png' }) : send(res, 404, { message: 'Not found' });
		return send(res, 404, { message: 'Not found' });
	}, { port });
}

// --- Nextcloud ----------------------------------------------------------------
export function nextcloudMock(port?: number) {
	const files = [
		{ path: 'Reports/budget.csv', id: 81, size: 20, at: Date.now() - 60e3 },
		{ path: 'notes & ideas.md', id: 80, size: 10, at: Date.now() - 120e3 },
		{ path: 'Reports/q3 summary.txt', id: 79, size: 30, at: Date.now() - 180e3 }
	];
	return serve((req, res, url) => {
		const { username, appPassword } = TOKENS.nextcloud;
		if (basic(req) !== `${username}:${appPassword}`) return send(res, 401, { ocs: { meta: { status: 'failure', statuscode: 997 } } });
		if (url.pathname === `/ocs/v2.php/cloud/users/${username}`) return send(res, 200, { ocs: { data: { displayname: 'Ann', quota: { used: 65646189, total: 1e9, quota: 1e9 } } } });
		if (url.pathname === '/ocs/v2.php/apps/serverinfo/api/v1/info') return send(res, 200, { ocs: { data: { nextcloud: { system: { version: '31.0.1', cpuload: [0.4], freespace: 9e11 }, storage: { num_files: 1234 } }, activeUsers: { last24hours: 2 } } } });
		if (url.pathname === '/remote.php/dav/' && req.method === 'SEARCH') {
			const limit = Number(req.body.toString().match(/<d:nresults>(\d+)<\/d:nresults>/)?.[1] ?? 10);
			const body = files.slice(0, limit).map((f) => `<d:response><d:href>/remote.php/dav/files/${username}/${f.path.split('/').map(encodeURIComponent).join('/')}</d:href><d:propstat><d:prop><d:displayname>${f.path.split('/').pop()!.replace(/&/g, '&amp;')}</d:displayname><d:getlastmodified>${new Date(f.at).toUTCString()}</d:getlastmodified><d:getcontentlength>${f.size}</d:getcontentlength><oc:fileid>${f.id}</oc:fileid></d:prop></d:propstat></d:response>`).join('');
			return send(res, 207, `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">${body}</d:multistatus>`, { 'content-type': 'application/xml' });
		}
		return send(res, 404, '');
	}, { port });
}

// --- Gitea / Forgejo -----------------------------------------------------------
export function giteaMock(port?: number) {
	const day = 86400e3;
	const repos = [
		{ full_name: 'ann/old-tool', updated_at: new Date(Date.now() - 30 * day).toISOString(), stars_count: 1, open_issues_count: 0, open_pr_counter: 0, private: false },
		{ full_name: 'ann/catboard', updated_at: new Date(Date.now() - 60e3).toISOString(), stars_count: 12, open_issues_count: 2, open_pr_counter: 1, private: false },
		{ full_name: 'homelab/infra', updated_at: new Date(Date.now() - day).toISOString(), stars_count: 0, open_issues_count: 1, open_pr_counter: 0, private: true }
	].map((r) => ({ ...r, html_url: `https://git.example.com/${r.full_name}` }));
	const issue = (repo: string, number: number, title: string, ago: number, pull = false) => ({
		number, title, html_url: `https://git.example.com/${repo}/${pull ? 'pulls' : 'issues'}/${number}`, updated_at: new Date(Date.now() - ago).toISOString(),
		user: { login: 'bob' }, repository: { full_name: repo }, pull_request: pull ? { merged: false } : null
	});
	const issues = [issue('ann/catboard', 7, 'Dark theme flickers', 5 * 60e3), issue('homelab/infra', 3, 'Renew certificates', 2 * day), issue('ann/catboard', 6, 'Old bug', 3 * day)];
	const pulls = [issue('ann/catboard', 8, 'Add French', 60e3, true)];
	return serve((req, res, url) => {
		if (url.pathname === '/api/v1/version') return send(res, 200, { version: '1.22.3' });
		if (req.headers.authorization !== `token ${TOKENS.gitea.apiToken}`) return send(res, 401, { message: 'token is required' });
		if (url.pathname === '/api/v1/user') return send(res, 200, { login: 'ann', full_name: 'Ann' });
		if (url.pathname === '/api/v1/user/repos') return send(res, 200, repos);
		if (url.pathname === '/api/v1/repos/issues/search') {
			const list = url.searchParams.get('type') === 'pulls' ? pulls : issues;
			const limit = Number(url.searchParams.get('limit') ?? 10);
			return send(res, 200, list.slice(0, limit), { 'x-total-count': String(list.length) });
		}
		return send(res, 404, { message: 'not found' });
	}, { port });
}

// --- Status target --------------------------------------------------------------
/** Counts HEAD probes per path (other requests, like icon lookups, are not counted); /down/* answers 500. Slow enough to overlap concurrent checks. */
export function statusTarget(port?: number) {
	const hits: Record<string, number> = {};
	return serve(async (req, res, url) => {
		if (req.method !== 'HEAD') return send(res, 404, '');
		hits[url.pathname] = (hits[url.pathname] ?? 0) + 1;
		await new Promise((r) => setTimeout(r, 150));
		send(res, url.pathname.startsWith('/down') ? 500 : 200, 'ok');
	}, { port }).then((m) => Object.assign(m, { hits }));
}

export async function startAll(ports: Partial<Record<'jenkins' | 'psitransfer' | 'proxmox' | 'portainer' | 'immich' | 'nextcloud' | 'gitea' | 'status', number>> = {}) {
	const [jenkins, psitransfer, proxmox, portainer, immich, nextcloud, gitea, status] = await Promise.all([
		jenkinsMock(ports.jenkins),
		psitransferMock(ports.psitransfer),
		proxmoxMock(ports.proxmox),
		portainerMock(ports.portainer),
		immichMock(ports.immich),
		nextcloudMock(ports.nextcloud),
		giteaMock(ports.gitea),
		statusTarget(ports.status)
	]);
	const all = { jenkins, psitransfer, proxmox, portainer, immich, nextcloud, gitea, status };
	return { ...all, close: () => Promise.all(Object.values(all).map((m) => m.close())) };
}
