// Playwright's web server for the E2E tests (run with Node's TypeScript type
// stripping): starts the fake services, the built app on E2E_PORT with a
// temporary config, creates the admin, connects every integration to the
// fakes, then answers on E2E_PORT + 1 /ready so Playwright knows it can start.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { startAll, TOKENS } from '../mocks/services.ts';
import { E2E_PORT, ADMIN, USER } from './env.ts';

if (!existsSync('build/index.js')) {
	console.error('Run `npm run build` before the E2E tests');
	process.exit(1);
}

const base = `http://127.0.0.1:${E2E_PORT}`;
const configDir = await mkdtemp(join(tmpdir(), 'catboard-e2e-'));
const mocks = await startAll();
const app = spawn(process.execPath, ['build'], {
	env: { ...process.env, CONFIG_DIR: configDir, PORT: String(E2E_PORT), HOST: '127.0.0.1', ORIGIN: base, SESSION_SECRET: 'e2e-tests-only', NODE_ENV: 'production' },
	stdio: 'inherit'
});

async function stop() {
	app.kill();
	await mocks.close().catch(() => {});
	await rm(configDir, { recursive: true, force: true }).catch(() => {});
	process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
app.on('exit', (code) => {
	if (code) console.error(`CatBoard exited with ${code}`);
});

for (let i = 0; ; i++) {
	try {
		await fetch(`${base}/login`);
		break;
	} catch {
		if (i > 100) throw new Error('CatBoard did not start');
		await new Promise((r) => setTimeout(r, 200));
	}
}

const post = (path: string, body: unknown, cookie = '', method = 'POST') =>
	fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
await post('/api/auth/setup', ADMIN);
const cookie = ((await post('/api/auth/login', ADMIN)).headers.get('set-cookie') ?? '').split(';')[0];
await post('/api/users', { ...USER, role: 'user' }, cookie);
await post('/api/integrations', {
	jenkins: { url: mocks.jenkins.url, ...TOKENS.jenkins },
	psitransfer: { url: mocks.psitransfer.url },
	proxmox: { clusters: [{ id: 'c1', name: 'Lab', url: mocks.proxmox.url, ...TOKENS.proxmox, insecure: 'true' }] },
	portainer: { url: mocks.portainer.url, ...TOKENS.portainer },
	immich: { url: mocks.immich.url, apiKey: TOKENS.immich.adminKey },
	nextcloud: { url: mocks.nextcloud.url, ...TOKENS.nextcloud }
}, cookie, 'PUT');
await post('/api/services', { name: 'Grafana', url: mocks.status.url + '/grafana', description: 'Dashboards', statusCheck: { enabled: true, method: 'HEAD' } }, cookie);

http.createServer((_req, res) => res.end('ready')).listen(E2E_PORT + 1, '127.0.0.1');
console.log(`E2E server ready on ${base}`);
