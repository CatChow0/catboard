import { json, type RequestHandler } from '@sveltejs/kit';
import { getIntegrations } from '$lib/server/config';
import type { StackerSnapshot } from '$lib/types';

function normalizeUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

/**
 * Proxies Stacker's /api/snapshot for one configured server. The widget polls
 * this with `since` (the last sample timestamp it received from that server),
 * so each response only carries the new samples. Credentials stay server-side.
 */
export const GET: RequestHandler = async ({ url }) => {
	const serverId = url.searchParams.get('serverId') || '';
	const integrations = await getIntegrations();
	const server = integrations.stacker?.servers?.find((s) => s.id === serverId);
	if (!server?.url) {
		return json({ error: 'Stacker server not configured' }, { status: 404 });
	}

	const params = new URLSearchParams();
	const since = url.searchParams.get('since');
	if (since && /^\d+$/.test(since)) params.set('since', since);
	if (url.searchParams.get('static') === '1') params.set('static', '1');
	params.set('limit', '60');

	const headers: Record<string, string> = { Accept: 'application/json' };
	if (server.username) {
		headers.Authorization = 'Basic ' + btoa(`${server.username}:${server.password ?? ''}`);
	}

	try {
		const res = await fetch(`${normalizeUrl(server.url)}/api/snapshot?${params}`, {
			headers,
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) {
			const hint = res.status === 401 ? ' (check the username and password)' : res.status === 404 ? ' (is this Stacker up to date?)' : '';
			return json({ error: `Stacker answered HTTP ${res.status}${hint}` }, { status: 502 });
		}
		// Stacker versions without /api/snapshot answer unknown paths with the
		// web UI (HTML, status 200) rather than a 404.
		if (!res.headers.get('content-type')?.includes('application/json')) {
			return json({ error: 'This Stacker has no /api/snapshot endpoint yet: update and redeploy Stacker' }, { status: 502 });
		}
		const data = (await res.json()) as StackerSnapshot;
		return json(data, { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		const timeout = err instanceof Error && err.name === 'TimeoutError';
		if (timeout) {
			return json({ error: `Stacker at ${server.url} did not answer within 5 s` }, { status: 502 });
		}
		// Node's fetch only says "fetch failed"; the real reason is in `cause`.
		type NetError = { code?: string; message?: string; errors?: NetError[] };
		const cause = (err as { cause?: NetError })?.cause;
		// Connection errors may arrive wrapped in an AggregateError (one per address tried).
		const code = cause?.code ?? cause?.errors?.[0]?.code;
		const reason =
			code === 'ENOTFOUND' || code === 'EAI_AGAIN'
				? 'host name not found (is CatBoard on the same Docker network?)'
				: code === 'ECONNREFUSED'
					? 'connection refused (wrong port, or Stacker not listening)'
					: code || cause?.message || (err instanceof Error ? err.message : String(err));
		console.error(`[stacker] ${server.url}:`, cause ?? err);
		return json({ error: `Cannot reach Stacker at ${server.url}: ${reason}` }, { status: 502 });
	}
};
