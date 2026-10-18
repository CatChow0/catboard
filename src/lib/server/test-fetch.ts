// Test helper: a fake fetch that answers from a list of routes and records the
// requests it got. Only imported by *.test.ts files.
import { vi } from 'vitest';

export type Recorded = { method: string; url: string; headers: Record<string, string>; body: string | null };
type Handler = (req: Recorded) => Response | Promise<Response>;

export const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string>) } });

/** Routes are "METHOD path-or-regex"; the first match answers, others get 404. */
export function fakeFetch(routes: [string | RegExp, Handler][]) {
	const calls: Recorded[] = [];
	const fn = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
		const url = String(input instanceof Request ? input.url : input);
		const method = (init.method ?? 'GET').toUpperCase();
		const headers: Record<string, string> = {};
		new Headers(init.headers as HeadersInit).forEach((v, k) => (headers[k] = v));
		const body = init.body == null ? null : init.body instanceof URLSearchParams ? init.body.toString() : typeof init.body === 'string' ? init.body : '[binary]';
		const req = { method, url, headers, body };
		calls.push(req);
		for (const [pattern, handler] of routes) {
			if (typeof pattern === 'string') {
				const [m, path] = pattern.includes(' ') ? pattern.split(' ') : ['GET', pattern];
				if (m === method && new URL(url).pathname + new URL(url).search === path) return handler(req);
				if (m === method && new URL(url).pathname === path) return handler(req);
			} else if (pattern.test(`${method} ${url}`)) return handler(req);
		}
		return new Response('not found', { status: 404 });
	});
	vi.stubGlobal('fetch', fn);
	return { fn, calls };
}
