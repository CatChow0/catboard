// Settings > Integrations: storage, secrets, and Test connection for every
// integration against the fake services.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, type Client } from './helpers';
import { startAll, psitransferMock, TOKENS } from '../mocks/services';

let mocks: Awaited<ReturnType<typeof startAll>>;
let admin: Client;
const test = async (key: string, value: Record<string, unknown>) => (await admin.post('/api/integrations/test', { key, value })).body as { ok: boolean; message: string };

beforeAll(async () => {
	mocks = await startAll();
	admin = await client('admin');
});
afterAll(async () => {
	await admin.put('/api/integrations', { jenkins: null, immich: null, proxmox: null, spoolman: null });
	await mocks.close();
});

describe('storage', () => {
	it('PUT replaces a connection, null removes it, other keys stay', async () => {
		await admin.put('/api/integrations', { spoolman: { url: 'http://spoolman:7912' }, jenkins: { url: 'http://j', username: 'u', apiToken: 'secret-token' } });
		await admin.put('/api/integrations', { spoolman: null });
		const cfg = (await admin.get('/api/integrations')).body;
		expect(cfg.spoolman).toBeUndefined();
		expect(cfg.jenkins.apiToken).toBe('secret-token');
	});

	it('plain users see the connections without their secrets', async () => {
		await admin.put('/api/integrations', {
			immich: { url: 'http://immich', apiKey: 'k' },
			proxmox: { clusters: [{ id: 'c1', name: 'Lab', url: 'https://pve', tokenId: 'a@pve!b', tokenSecret: 'shh' }] }
		});
		const cfg = (await (await client('user')).get('/api/integrations')).body;
		expect(cfg.jenkins).toMatchObject({ url: 'http://j', username: 'u', apiToken: '' });
		expect(cfg.immich.apiKey).toBe('');
		expect(cfg.proxmox.clusters[0]).toMatchObject({ name: 'Lab', tokenId: 'a@pve!b', tokenSecret: '' });
	});
});

describe('test connection', () => {
	it('asks for a full URL', async () => {
		expect((await test('spoolman', { url: 'spoolman:7912' })).message).toMatch(/full URL/);
	});

	it('Jenkins: version, wrong token', async () => {
		expect(await test('jenkins', { url: mocks.jenkins.url, ...TOKENS.jenkins })).toEqual({ ok: true, message: 'Jenkins 2.479.1' });
		expect(await test('jenkins', { url: mocks.jenkins.url, username: 'ci', apiToken: 'nope' })).toMatchObject({ ok: false, message: expect.stringMatching(/refused/) });
	});

	it('PsiTransfer: retentions, upload password missing / wrong / right', async () => {
		expect(await test('psitransfer', { url: mocks.psitransfer.url })).toMatchObject({ ok: true, message: 'PsiTransfer is reachable (3 retention choices)', code: 'test.psiOk' });
		const locked = await psitransferMock(undefined, { uploadPassword: TOKENS.psitransfer.uploadPassword });
		try {
			expect((await test('psitransfer', { url: locked.url })).message).toMatch(/asks for an upload password/);
			expect((await test('psitransfer', { url: locked.url, uploadPassword: 'nope' })).message).toMatch(/refused the upload password/);
			expect((await test('psitransfer', { url: locked.url, ...TOKENS.psitransfer })).ok).toBe(true);
		} finally {
			await locked.close();
		}
	});

	it('Proxmox: refuses the self-signed certificate unless told to skip TLS checks', async () => {
		const value = { url: mocks.proxmox.url, ...TOKENS.proxmox };
		expect(await test('proxmox', value)).toMatchObject({ ok: false, message: expect.stringMatching(/TLS error/) });
		expect(await test('proxmox', { ...value, insecure: 'true' })).toEqual({ ok: true, message: 'Proxmox VE 8.2.4' });
		expect((await test('proxmox', { ...value, insecure: 'true', tokenSecret: 'x' })).message).toMatch(/refused the API token/);
		expect((await test('proxmox', { ...value, insecure: 'true', tokenId: 'no-realm' })).message).toMatch(/user@realm!name/);
	});

	it('Portainer: version, wrong token', async () => {
		expect(await test('portainer', { url: mocks.portainer.url, ...TOKENS.portainer })).toEqual({ ok: true, message: 'Portainer 2.33.7' });
		expect((await test('portainer', { url: mocks.portainer.url, apiKey: 'ptr_bad' })).message).toMatch(/refused the access token/);
	});

	it('Immich: tells admin keys apart', async () => {
		expect(await test('immich', { url: mocks.immich.url, apiKey: TOKENS.immich.adminKey })).toMatchObject({ ok: true, message: 'Immich 3.3.3, key of Admin (admin)' });
		expect(await test('immich', { url: mocks.immich.url, apiKey: TOKENS.immich.userKey })).toMatchObject({ ok: true, message: 'Immich 3.3.3, key of User' });
		expect((await test('immich', { url: mocks.immich.url, apiKey: 'bad' })).message).toMatch(/refused the API key/);
	});

	it('Deezer to Navidrome: reads the release feed', async () => {
		expect(await test('deezer', { url: mocks.deezer.url, ...TOKENS.deezer })).toMatchObject({ ok: true, message: '4 releases from 3 favorite artists', code: 'test.deezerOk' });
		expect(await test('deezer', { url: mocks.deezer.url, apiToken: 'bad' })).toMatchObject({ ok: false, code: 'errors.deezerAuth' });
		expect(await test('deezer', { url: mocks.status.url })).toMatchObject({ ok: false, code: 'errors.answeredHttp' });
	});

	it('Gitea / Forgejo: checks the version, then the token', async () => {
		expect(await test('gitea', { url: mocks.gitea.url, ...TOKENS.gitea })).toMatchObject({ ok: true, message: 'Gitea / Forgejo 1.22.3, signed in as Ann', code: 'test.giteaOk' });
		expect(await test('gitea', { url: mocks.gitea.url, apiToken: 'bad' })).toMatchObject({ ok: false, code: 'errors.giteaAuth' });
		expect(await test('gitea', { url: mocks.gitea.url })).toMatchObject({ ok: false, code: 'errors.enterToken' });
		expect(await test('gitea', { url: mocks.nextcloud.url, apiToken: 'x' })).toMatchObject({ ok: false, code: 'errors.notLike' });
	});

	it('Nextcloud: signs in with an app password', async () => {
		expect(await test('nextcloud', { url: mocks.nextcloud.url, ...TOKENS.nextcloud })).toMatchObject({ ok: true, message: 'Nextcloud, signed in as Ann' });
		expect((await test('nextcloud', { url: mocks.nextcloud.url, username: 'ann', appPassword: 'bad' })).message).toMatch(/app password/);
		expect((await test('nextcloud', { url: mocks.nextcloud.url })).message).toMatch(/username/);
	});

	it('explains an unreachable service', async () => {
		const closed = await psitransferMock();
		const url = closed.url;
		await closed.close();
		expect(await test('jenkins', { url, ...TOKENS.jenkins })).toMatchObject({ ok: false, message: expect.stringMatching(/Connection refused/) });
	});
});
