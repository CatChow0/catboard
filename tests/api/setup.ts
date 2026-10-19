// Vitest globalSetup for the API tests: starts the built app (`npm run build`
// first) on a free port with an empty, temporary config folder, creates the
// admin and a plain user, and stops everything at the end.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import type { TestProject } from 'vitest/node';

export const ADMIN = { username: 'admin', password: 'admin-pass-123' };
export const USER = { username: 'viewer', password: 'viewer-pass-123' };

declare module 'vitest' {
	export interface ProvidedContext {
		baseUrl: string;
		configDir: string;
	}
}

const freePort = () =>
	new Promise<number>((resolve, reject) => {
		const s = net.createServer();
		s.on('error', reject);
		s.listen(0, '127.0.0.1', () => {
			const { port } = s.address() as net.AddressInfo;
			s.close(() => resolve(port));
		});
	});

async function waitFor(url: string, ms: number) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		try {
			await fetch(url);
			return;
		} catch {
			await new Promise((r) => setTimeout(r, 200));
		}
	}
	throw new Error(`CatBoard did not start at ${url}`);
}

let server: ChildProcess | undefined;
let configDir = '';

export default async function setup(project: TestProject) {
	if (!existsSync('build/index.js')) throw new Error('Run `npm run build` before the API tests');
	configDir = await mkdtemp(join(tmpdir(), 'catboard-api-'));
	const port = await freePort();
	const baseUrl = `http://127.0.0.1:${port}`;
	server = spawn(process.execPath, ['build'], {
		env: { ...process.env, CONFIG_DIR: configDir, PORT: String(port), HOST: '127.0.0.1', ORIGIN: baseUrl, SESSION_SECRET: 'api-tests-only', NODE_ENV: 'production', LOGIN_RATE_LIMIT_MS: '1000' },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	let output = '';
	server.stdout?.on('data', (d) => (output += d));
	server.stderr?.on('data', (d) => (output += d));
	server.on('exit', (code) => {
		if (code && code !== 0) console.error(`CatBoard exited with ${code}\n${output}`);
	});
	await waitFor(`${baseUrl}/login`, 20_000);

	const post = (path: string, body: unknown, cookie = '') =>
		fetch(baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
	const setupRes = await post('/api/auth/setup', ADMIN);
	if (!setupRes.ok) throw new Error(`Setup failed: ${setupRes.status} ${await setupRes.text()}`);
	const login = await post('/api/auth/login', ADMIN);
	const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
	const userRes = await post('/api/users', { ...USER, role: 'user' }, cookie);
	if (!userRes.ok) throw new Error(`Creating the test user failed: ${userRes.status} ${await userRes.text()}`);

	project.provide('baseUrl', baseUrl);
	project.provide('configDir', configDir);

	return async () => {
		server?.kill();
		await new Promise((r) => setTimeout(r, 300));
		await rm(configDir, { recursive: true, force: true }).catch(() => {});
	};
}
