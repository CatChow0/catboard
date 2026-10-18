// Signed-in clients for the API tests: `const admin = await client('admin')`,
// then admin.get('/api/...'), admin.put(path, body)... Each call returns
// { status, body, headers }; bodies are parsed as JSON when they are JSON.
import { inject } from 'vitest';
import { ADMIN, USER } from './setup';

export type Res<T = any> = { status: number; body: T; headers: Headers };

export function baseUrl() {
	return inject('baseUrl');
}

async function call(cookie: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
	const raw = body instanceof Uint8Array || typeof body === 'string';
	const res = await fetch(baseUrl() + path, {
		method,
		headers: { cookie, ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}), ...headers },
		body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body)
	});
	const text = await res.text();
	let parsed: unknown = text;
	try {
		parsed = JSON.parse(text);
	} catch {
		// not JSON
	}
	return { status: res.status, body: parsed, headers: res.headers };
}

export type Client = ReturnType<typeof clientFor>;

function clientFor(cookie: string) {
	return {
		cookie,
		get: (path: string) => call(cookie, 'GET', path),
		post: (path: string, body?: unknown, headers?: Record<string, string>) => call(cookie, 'POST', path, body ?? {}, headers),
		put: (path: string, body: unknown) => call(cookie, 'PUT', path, body),
		patch: (path: string, body: unknown, headers?: Record<string, string>) => call(cookie, 'PATCH', path, body, headers),
		del: (path: string) => call(cookie, 'DELETE', path)
	};
}

export async function login(username: string, password: string) {
	const res = await fetch(baseUrl() + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
	return { status: res.status, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] };
}

/** A signed-in client: 'admin', 'user', or no session at all ('anon'). */
export async function client(who: 'admin' | 'user' | 'anon') {
	if (who === 'anon') return clientFor('');
	const creds = who === 'admin' ? ADMIN : USER;
	const { status, cookie } = await login(creds.username, creds.password);
	if (status !== 200) throw new Error(`Login as ${who} failed (${status})`);
	return clientFor(cookie);
}
