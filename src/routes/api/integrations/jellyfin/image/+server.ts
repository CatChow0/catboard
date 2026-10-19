import { json, type RequestHandler } from '@sveltejs/kit';
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import { JELLYFIN_IMAGE_TYPES } from '$lib/server/jellyfin';
import { apiError } from '$lib/server/api-error';

/**
 * Image proxy for Jellyfin artwork: GET ?item=&type=&tag=&w=
 * Parameters are validated so this can only ever fetch an item image.
 */
export const GET: RequestHandler = async ({ url }) => {
	const conn = (await getIntegrations()).jellyfin;
	if (!conn?.url) return apiError(404, 'errors.notSetUp', { name: 'Jellyfin' });

	const item = url.searchParams.get('item') || '';
	const type = url.searchParams.get('type') || '';
	const tag = url.searchParams.get('tag') || '';
	const w = Math.min(Math.max(parseInt(url.searchParams.get('w') || '400', 10) || 400, 50), 1600);
	if (!/^[a-f0-9-]{8,64}$/i.test(item) || !JELLYFIN_IMAGE_TYPES.has(type) || !/^[a-z0-9]{0,64}$/i.test(tag)) {
		return apiError(400, 'errors.badImage');
	}

	const q = new URLSearchParams({ maxWidth: String(w), quality: '85' });
	if (tag) q.set('tag', tag);
	try {
		const res = await fetch(`${normalizeUrl(conn.url)}/Items/${item}/Images/${type}?${q}`, {
			headers: conn.apiKey ? { 'X-Emby-Token': conn.apiKey } : {},
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok || !res.body) return new Response(null, { status: res.status === 404 ? 404 : 502 });
		return new Response(res.body, {
			headers: {
				'Content-Type': res.headers.get('content-type') || 'image/jpeg',
				// The tag changes when the artwork changes, so caching is safe.
				'Cache-Control': 'private, max-age=86400'
			}
		});
	} catch {
		return new Response(null, { status: 502 });
	}
};
