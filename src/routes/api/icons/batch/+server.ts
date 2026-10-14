import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveIcon, readIconFile } from '$lib/server/icon-cache';

const MAX_ITEMS = 200;

/**
 * POST {items: [{key, icon, name, url}]} — several service icons in one
 * request, as base64 ({key: {type, data} | null}). Loaded with fetch(), it is
 * not queued behind long-lived connections like <img> requests are on
 * HTTP/1.1, and the client keeps the result in IndexedDB.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const items: { key?: unknown; icon?: unknown; name?: unknown; url?: unknown }[] = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS) : [];
	const out: Record<string, { type: string; data: string } | null> = {};
	await Promise.all(
		items.map(async (it) => {
			const key = String(it.key ?? '');
			if (!key) return;
			try {
				const entry = await resolveIcon(String(it.icon ?? ''), String(it.name ?? ''), String(it.url ?? ''));
				const data = entry && (await readIconFile(entry.filename));
				out[key] = entry && data ? { type: entry.contentType, data: data.toString('base64') } : null;
			} catch {
				out[key] = null;
			}
		})
	);
	return json({ icons: out }, { headers: { 'Cache-Control': 'no-store' } });
};
