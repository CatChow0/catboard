import type { RequestHandler } from './$types';
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';

const SOURCES = new Set(['radarr', 'sonarr', 'lidarr']);
// Only *Arr artwork: /MediaCover/... or /api/v1|v3/MediaCover/..., optional ?lastWrite=...
const PATH_RE = /^\/(?:api\/v[13]\/)?MediaCover\/[A-Za-z0-9_\-/.]+(?:\?[A-Za-z0-9_=&.\-]*)?$/;

/**
 * GET ?source=radarr|sonarr|lidarr&path=/api/v3/MediaCover/... — poster of a
 * Radarr / Sonarr / Lidarr item, fetched with the API key on the server so the
 * key is never sent to the browser.
 */
export const GET: RequestHandler = async ({ url }) => {
	const source = url.searchParams.get('source') || '';
	const path = url.searchParams.get('path') || '';
	if (!SOURCES.has(source) || !PATH_RE.test(path) || path.includes('..')) return new Response('Bad request', { status: 400 });
	const conn = (await getIntegrations())[source as 'radarr' | 'sonarr' | 'lidarr'];
	if (!conn?.url) return new Response('Not configured', { status: 404 });
	try {
		const res = await fetch(`${normalizeUrl(conn.url)}${path}`, { headers: { 'X-Api-Key': conn.apiKey }, signal: AbortSignal.timeout(10000) });
		const type = res.headers.get('content-type') || '';
		if (!res.ok || !type.startsWith('image/')) return new Response('Not found', { status: 404 });
		return new Response(await res.arrayBuffer(), {
			headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' }
		});
	} catch {
		return new Response('Unreachable', { status: 502 });
	}
};
