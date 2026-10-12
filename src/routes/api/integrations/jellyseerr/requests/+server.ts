import { json, type RequestHandler } from '@sveltejs/kit';
import { jellyseerrConn, seerr, toRequest } from '$lib/server/jellyseerr';
import type { JellyseerrData } from '$lib/types';

/** GET ?filter=pending|all&take=N — latest media requests plus counters. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await jellyseerrConn();
	if (!conn) return json({ error: 'Jellyseerr / Overseerr not configured' }, { status: 404 });
	const filter = url.searchParams.get('filter') === 'pending' ? 'pending' : 'all';
	const take = Math.min(Math.max(parseInt(url.searchParams.get('take') || '10', 10) || 10, 1), 30);
	try {
		const [list, count] = await Promise.all([
			seerr(conn, `/request?take=${take}&skip=0&filter=${filter}&sort=added`),
			seerr(conn, '/request/count')
		]);
		const requests = await Promise.all(((list?.results ?? []) as Record<string, unknown>[]).map((r) => toRequest(conn, r)));
		const data: JellyseerrData = {
			counts: {
				pending: count?.pending ?? 0,
				approved: count?.approved ?? 0,
				processing: count?.processing ?? 0,
				available: count?.available ?? 0
			},
			requests
		};
		return json(data, { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		const msg = err instanceof Error ? err.message : '';
		return json({ error: msg.startsWith('HTTP') ? `Jellyseerr answered ${msg}` : 'Cannot reach Jellyseerr / Overseerr' }, { status: 502 });
	}
};
