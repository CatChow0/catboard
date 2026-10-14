import type { RequestHandler } from './$types';
import { resolveIcon, readIconFile, etagOf } from '$lib/server/icon-cache';

/**
 * GET ?icon=<value>&name=<service name>&url=<service url> — the service icon,
 * resolved and cached by the server (see icon-cache.ts). `?url=` alone still
 * works (favicon only), for old links.
 */
export const GET: RequestHandler = async ({ url, request }) => {
	const icon = url.searchParams.get('icon') ?? '';
	const name = url.searchParams.get('name') ?? '';
	const serviceUrl = url.searchParams.get('url') ?? '';
	if (!icon && !name && !serviceUrl) return new Response('Missing icon, name or url', { status: 400 });

	const entry = await resolveIcon(icon, name, serviceUrl);
	if (!entry) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

	const etag = etagOf(entry);
	const headers: Record<string, string> = {
		'Content-Type': entry.contentType,
		// The URL changes when the icon setting changes, so browsers can keep it.
		'Cache-Control': 'private, max-age=604800, stale-while-revalidate=86400',
		ETag: etag,
		'X-Content-Type-Options': 'nosniff',
		// SVGs can carry scripts: never run them, even if opened directly.
		'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
	};
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

	const data = await readIconFile(entry.filename);
	if (!data) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
	return new Response(new Uint8Array(data), { headers });
};
