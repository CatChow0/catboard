// Integration clients against a fake fetch: the requests they send and how
// they read the answers.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeFetch, json } from './test-fetch';
import { jobPath, publicLink, recentBuilds, jobParameters, startBuild, jenkins, type JenkinsConn } from './jenkins';
import { isSid, safeName, createUpload, appendChunk, type PsiConn } from './psitransfer';
import { pveConnOf, resources, guestAction } from './proxmox';
import { overview as portainerOverview, stackAction, type PortainerConn } from './portainer';
import { summary as immichSummary, isAssetId, type ImmichConn } from './immich';
import { parseSearch, overview as nextcloudOverview, nextcloudConnOf } from './nextcloud';

vi.mock('$lib/server/config', () => ({ getIntegrations: async () => ({}) }));
afterEach(() => vi.unstubAllGlobals());

// --- Jenkins ------------------------------------------------------------------
describe('jenkins', () => {
	const conn: JenkinsConn = { base: 'http://jenkins:8080', publicBase: 'https://ci.example.com', auth: 'Basic dTp0' };
	const build = (n: number, ts: number, extra = {}) => ({ number: n, result: 'SUCCESS', building: false, timestamp: ts, duration: 1000, estimatedDuration: 900, url: `http://jenkins:8080/job/x/${n}/`, ...extra });

	it('jobPath walks folders and encodes names', () => {
		expect(jobPath('team/deploy prod')).toBe('job/team/job/deploy%20prod');
		expect(jobPath('/hello/')).toBe('job/hello');
	});

	it('publicLink moves links to the public address, also under a path prefix', () => {
		expect(publicLink(conn, 'http://jenkins:8080/job/x/3/')).toBe('https://ci.example.com/job/x/3/');
		const sub = { ...conn, base: 'http://host/jenkins', publicBase: 'https://ci.example.com' };
		expect(publicLink(sub, 'http://host/jenkins/job/x/3/')).toBe('https://ci.example.com/job/x/3/');
		expect(publicLink(conn, 'not a url')).toBe('not a url');
	});

	it('recentBuilds merges every job (folders included), newest first, limited', async () => {
		const { calls } = fakeFetch([
			[/GET .*\/api\/json\?tree=/, () => json({ jobs: [
				{ name: 'a', builds: [build(1, 100), build(2, 300)] },
				{ name: 'team', jobs: [{ name: 'deploy', fullName: 'team/deploy', builds: [build(7, 200, { building: true, result: null })] }] }
			] })]
		]);
		const data = await recentBuilds(conn, '', 2);
		expect(data.builds.map((b) => `${b.job}#${b.number}`)).toEqual(['a#2', 'team/deploy#7']);
		expect(data.builds[1]).toMatchObject({ building: true, result: null });
		expect(data.builds[0].url).toBe('https://ci.example.com/job/x/2/');
		expect(calls[0].headers.authorization).toBe('Basic dTp0');
	});

	it('recentBuilds for one job reads its queue and parameters', async () => {
		fakeFetch([[/job\/team\/job\/deploy\/api\/json/, () => json({ url: 'http://jenkins:8080/job/team/job/deploy/', buildable: true, inQueue: true, property: [{}, { parameterDefinitions: [{ name: 'X' }] }], builds: [build(1, 1)] })]]);
		const data = await recentBuilds(conn, 'team/deploy', 5);
		expect(data).toMatchObject({ inQueue: true, hasParameters: true, buildable: true, jobUrl: 'https://ci.example.com/job/team/job/deploy/' });
	});

	it('jobParameters maps types and defaults', async () => {
		fakeFetch([[/api\/json/, () => json({ property: [{ parameterDefinitions: [
			{ name: 'T', type: 'StringParameterDefinition', defaultParameterValue: { value: 'prod-1' } },
			{ name: 'E', type: 'ChoiceParameterDefinition', choices: ['production', 'staging'], defaultParameterValue: { value: 'production' } },
			{ name: 'D', type: 'BooleanParameterDefinition', defaultParameterValue: { value: true } },
			{ name: 'F', type: 'FileParameterDefinition' }
		] }] })]]);
		const params = await jobParameters(conn, 'x');
		expect(params.map((p) => [p.name, p.type, p.default])).toEqual([['T', 'string', 'prod-1'], ['E', 'choice', 'production'], ['D', 'boolean', true], ['F', 'other', '']]);
	});

	it('startBuild posts the parameters as a form', async () => {
		const { calls } = fakeFetch([[/POST .*buildWithParameters/, () => new Response(null, { status: 201 })]]);
		await startBuild(conn, 'team/deploy', { TARGET: 'srv-9', DRY_RUN: false });
		expect(calls[0].url).toBe('http://jenkins:8080/job/team/job/deploy/buildWithParameters');
		expect(calls[0].body).toBe('TARGET=srv-9&DRY_RUN=false');
	});

	it('the crumb fallback sends the POST once more, and only once', async () => {
		let posts = 0;
		fakeFetch([
			[/POST .*\/build$/, (r) => (++posts === 1 ? new Response('No valid crumb', { status: 403 }) : r.headers['jenkins-crumb'] === 'abc' ? new Response(null, { status: 201 }) : new Response('', { status: 403 }))],
			[/GET .*crumbIssuer/, () => json({ crumbRequestField: 'Jenkins-Crumb', crumb: 'abc' })]
		]);
		await startBuild(conn, 'hello');
		expect(posts).toBe(2);
	});

	it('explains refused starts', async () => {
		fakeFetch([[/crumbIssuer/, () => new Response('', { status: 404 })], [/POST/, () => new Response('', { status: 403 })]]);
		await expect(startBuild(conn, 'x')).rejects.toThrow('Job/Build permission');
		fakeFetch([[/POST/, () => new Response('', { status: 404 })]]);
		await expect(startBuild(conn, 'x')).rejects.toThrow('Job not found');
	});

	it('jenkins() never retries a GET', async () => {
		const { calls } = fakeFetch([[/GET/, () => new Response('', { status: 403 })]]);
		await jenkins(conn, 'api/json');
		expect(calls).toHaveLength(1);
	});
});

// --- PsiTransfer --------------------------------------------------------------
describe('psitransfer', () => {
	const conn: PsiConn = { base: 'http://psi:3000', publicBase: 'https://psi.example.com', password: 'up' };

	it('isSid accepts PsiTransfer bucket ids only', () => {
		expect(isSid('0123456789ab')).toBe(true);
		expect(isSid('0123456789AB')).toBe(false);
		expect(isSid('../etc/passwd')).toBe(false);
	});

	it('safeName keeps a flat, harmless file name', () => {
		expect(safeName('dir/../évil name?.png')).toBe('évil name_.png');
		expect(safeName('C:\\Users\\x\\report.pdf')).toBe('report.pdf');
		expect(safeName('...hidden')).toBe('hidden');
		expect(safeName('a\u0000b\u001fc')).toBe('a_b_c');
		expect(safeName('')).toBe('file');
		expect(safeName('x'.repeat(300))).toHaveLength(200);
	});

	it('createUpload sends tus metadata in base64 and the upload password', async () => {
		const { calls } = fakeFetch([['POST /files', () => new Response(null, { status: 201, headers: { location: 'http://psi:3000/files/0123456789ab++abc' } })]]);
		const id = await createUpload(conn, { sid: '0123456789ab', name: 'a/b.txt', size: 10, type: 'text/plain', retention: '3600', password: 'pw' });
		const req = calls[0];
		expect(req.headers['upload-length']).toBe('10');
		expect(req.headers['x-passwd']).toBe('up');
		expect(req.headers['tus-resumable']).toBe('1.0.0');
		const meta = Object.fromEntries(req.headers['upload-metadata'].split(',').map((p) => { const [k, v] = p.split(' '); return [k, Buffer.from(v ?? '', 'base64').toString()]; }));
		expect(meta).toMatchObject({ sid: '0123456789ab', name: 'b.txt', retention: '3600', password: 'pw', type: 'text/plain' });
		// The chunk goes to the path PsiTransfer gave, whatever host it named.
		const { calls: c2 } = fakeFetch([[/PATCH http:\/\/psi:3000\/files\/0123456789ab\+\+abc/, () => new Response(null, { status: 204, headers: { 'upload-offset': '10' } })]]);
		expect(await appendChunk(conn, id, 0, new ArrayBuffer(10))).toBe(10);
		expect(c2[0].headers['upload-offset']).toBe('0');
		await expect(appendChunk(conn, 'unknown', 0, new ArrayBuffer(1))).rejects.toThrow('Unknown or expired upload');
	});

	it('reports a refused upload password', async () => {
		fakeFetch([['POST /files', () => new Response('', { status: 403 })]]);
		await expect(createUpload(conn, { sid: '0123456789ab', name: 'x', size: 1, type: '', retention: '3600', password: '' })).rejects.toThrow('upload password');
	});
});

// --- Proxmox --------------------------------------------------------------------
describe('proxmox', () => {
	const conn = pveConnOf({ url: 'https://pve:8006/', tokenId: 'cb@pve!dash', tokenSecret: 'sec', insecure: '' });
	const res = [
		{ type: 'node', node: 'pve2', status: 'online', cpu: 0.5, maxcpu: 8, mem: 1, maxmem: 2, uptime: 9 },
		{ type: 'node', node: 'pve1', status: 'online', cpu: 0.1, maxcpu: 8, mem: 1, maxmem: 2, uptime: 9 },
		{ type: 'lxc', vmid: 200, name: 'pihole', node: 'pve1', status: 'running' },
		{ type: 'qemu', vmid: 100, name: 'ha', node: 'pve1', status: 'stopped' },
		{ type: 'qemu', vmid: 9000, name: 'tpl', node: 'pve1', status: 'stopped', template: 1 },
		{ type: 'storage', storage: 'local' }
	];

	it('sends the API token header', async () => {
		const { calls } = fakeFetch([[/cluster\/resources/, () => json({ data: res })]]);
		await resources(conn);
		expect(calls[0].url).toBe('https://pve:8006/api2/json/cluster/resources');
		expect(calls[0].headers.authorization).toBe('PVEAPIToken=cb@pve!dash=sec');
	});

	it('sorts nodes and guests, hides templates and other resources', async () => {
		fakeFetch([[/cluster\/resources/, () => json({ data: res })]]);
		const data = await resources(conn);
		expect(data.nodes.map((n) => n.node)).toEqual(['pve1', 'pve2']);
		expect(data.guests.map((g) => g.vmid)).toEqual([100, 200]);
		expect(data.url).toBe('https://pve:8006');
	});

	it('posts guest actions to the right path', async () => {
		const { calls } = fakeFetch([[/POST .*status\/start$/, () => json({ data: 'UPID:x' })]]);
		expect(await guestAction(conn, 'pve1', 'lxc', 200, 'start')).toBe('UPID:x');
		expect(calls[0].url).toBe('https://pve:8006/api2/json/nodes/pve1/lxc/200/status/start');
	});

	it('explains token problems', async () => {
		fakeFetch([[/./, () => new Response('', { status: 401 })]]);
		await expect(resources(conn)).rejects.toThrow('refused the API token');
		fakeFetch([[/./, () => new Response('', { status: 403 })]]);
		await expect(guestAction(conn, 'pve1', 'qemu', 100, 'stop')).rejects.toThrow('lacks the permission');
	});
});

// --- Portainer ------------------------------------------------------------------
describe('portainer', () => {
	const conn: PortainerConn = { base: 'http://portainer:9000', publicBase: 'https://p.example.com', apiKey: 'ptr_x', insecure: false };

	it('reads environment snapshots and stacks', async () => {
		const { calls } = fakeFetch([
			['GET /api/endpoints', () => json([{ Id: 2, Name: 'dind', Status: 1, Snapshots: [{ RunningContainerCount: 3, StoppedContainerCount: 1, UnhealthyContainerCount: 1 }] }, { Id: 3, Name: 'off', Status: 2 }])],
			['GET /api/stacks', () => json([{ Id: 2, Name: 'worker', EndpointId: 2, Status: 2, Type: 2 }, { Id: 1, Name: 'app', EndpointId: 2, Status: 1, Type: 2 }])]
		]);
		const data = await portainerOverview(conn);
		expect(calls[0].headers['x-api-key']).toBe('ptr_x');
		expect(data.endpoints).toEqual([
			{ id: 2, name: 'dind', up: true, running: 3, stopped: 1, healthy: 0, unhealthy: 1 },
			{ id: 3, name: 'off', up: false, running: 0, stopped: 0, healthy: 0, unhealthy: 0 }
		]);
		expect(data.stacks.map((s) => `${s.name}:${s.active}`)).toEqual(['app:true', 'worker:false']);
	});

	it('still shows the environments when stacks are forbidden', async () => {
		fakeFetch([['GET /api/endpoints', () => json([{ Id: 2, Name: 'dind', Status: 1 }])], ['GET /api/stacks', () => new Response('', { status: 403 })]]);
		const data = await portainerOverview(conn);
		expect(data.endpoints).toHaveLength(1);
		expect(data.stacks).toEqual([]);
	});

	it('a refused token fails the whole overview', async () => {
		fakeFetch([[/./, () => new Response('', { status: 401 })]]);
		await expect(portainerOverview(conn)).rejects.toThrow('refused the access token');
	});

	it('passes Portainer error details through', async () => {
		fakeFetch([[/POST .*\/stacks\/1\/stop\?endpointId=2/, () => json({ message: 'x', details: 'Stack is already inactive' }, { status: 400 })]]);
		await expect(stackAction(conn, 1, 2, 'stop')).rejects.toThrow('Stack is already inactive');
	});
});

// --- Immich -----------------------------------------------------------------------
describe('immich', () => {
	const conn: ImmichConn = { base: 'http://immich:2283', publicBase: 'https://photos.example.com', apiKey: 'k' };

	it('uses server statistics with an admin key', async () => {
		const { calls } = fakeFetch([
			['GET /api/server/statistics', () => json({ photos: 5, videos: 1, usage: 2048 })],
			['POST /api/search/metadata', () => json({ assets: { items: [{ id: 'a', fileCreatedAt: '2026-01-01' }] } })]
		]);
		const data = await immichSummary(conn, 4);
		expect(data.stats).toEqual({ photos: 5, videos: 1, usage: 2048, scope: 'server' });
		expect(data.recent).toEqual([{ id: 'a', date: '2026-01-01' }]);
		expect(JSON.parse(calls[1].body!)).toMatchObject({ type: 'IMAGE', order: 'desc', size: 4 });
		expect(calls[0].headers['x-api-key']).toBe('k');
	});

	it("falls back to the key owner's statistics, and skips photos when 0", async () => {
		const { calls } = fakeFetch([
			['GET /api/server/statistics', () => new Response('', { status: 403 })],
			['GET /api/assets/statistics', () => json({ images: 2, videos: 0, total: 2 })]
		]);
		const data = await immichSummary(conn, 0);
		expect(data.stats).toEqual({ photos: 2, videos: 0, usage: null, scope: 'user' });
		expect(calls.some((c) => c.url.includes('search'))).toBe(false);
	});

	it('isAssetId only accepts UUIDs', () => {
		expect(isAssetId('3f2b1a4c-1111-4222-8333-123456789abc')).toBe(true);
		expect(isAssetId('../../server/about')).toBe(false);
	});
});

// --- Nextcloud --------------------------------------------------------------------
describe('nextcloud', () => {
	const conn = nextcloudConnOf({ url: 'http://nc/', publicUrl: 'https://cloud.example.com', username: 'ann', appPassword: 'ap' });
	const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
<d:response><d:href>/remote.php/dav/files/ann/Reports/q3%20summary.txt</d:href><d:propstat><d:prop><d:displayname>q3 summary.txt</d:displayname><d:getlastmodified>Sun, 18 Oct 2026 10:00:00 GMT</d:getlastmodified><d:getcontentlength>12</d:getcontentlength><oc:fileid>79</oc:fileid></d:prop></d:propstat></d:response>
<d:response><d:href>/remote.php/dav/files/ann/notes%20%26%20ideas.md</d:href><d:propstat><d:prop><d:displayname>notes &amp; ideas.md</d:displayname><d:getlastmodified>Sun, 18 Oct 2026 09:00:00 GMT</d:getlastmodified><d:getcontentlength>3</d:getcontentlength></d:prop></d:propstat></d:response>
</d:multistatus>`;

	it('parseSearch decodes names and paths and links by file id', () => {
		const files = parseSearch(xml, conn, 10);
		expect(files).toEqual([
			{ name: 'q3 summary.txt', path: '/Reports/q3 summary.txt', modified: Date.parse('Sun, 18 Oct 2026 10:00:00 GMT'), size: 12, url: 'https://cloud.example.com/f/79' },
			{ name: 'notes & ideas.md', path: '/notes & ideas.md', modified: Date.parse('Sun, 18 Oct 2026 09:00:00 GMT'), size: 3, url: 'https://cloud.example.com/apps/files/' }
		]);
		expect(parseSearch(xml, conn, 1)).toHaveLength(1);
	});

	it('overview reads the quota (unlimited = null) and asks only for what is shown', async () => {
		const { calls } = fakeFetch([[/cloud\/users\/ann/, () => json({ ocs: { data: { displayname: 'Ann', quota: { used: 100, total: 5000, quota: -3 } } } })]]);
		const data = await nextcloudOverview(conn, { server: false, files: 0 });
		expect(data.user).toEqual({ name: 'Ann', used: 100, total: null });
		expect(data.server).toBeNull();
		expect(calls).toHaveLength(1);
		expect(calls[0].headers['ocs-apirequest']).toBe('true');
		expect(calls[0].headers.authorization).toBe('Basic ' + Buffer.from('ann:ap').toString('base64'));
	});

	it('server info is optional (null when not allowed)', async () => {
		fakeFetch([
			[/cloud\/users/, () => json({ ocs: { data: { quota: { used: 1, total: 10, quota: 10 } } } })],
			[/serverinfo/, () => new Response('', { status: 403 })],
			[/SEARCH/, () => new Response(xml, { status: 207 })]
		]);
		const data = await nextcloudOverview(conn, { server: true, files: 5 });
		expect(data.user.total).toBe(10);
		expect(data.server).toBeNull();
		expect(data.files).toHaveLength(2);
	});

	it('explains a wrong app password', async () => {
		fakeFetch([[/./, () => new Response('', { status: 401 })]]);
		await expect(nextcloudOverview(conn, { server: false, files: 0 })).rejects.toThrow('app password');
	});
});
