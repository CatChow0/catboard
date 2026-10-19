import { json, type RequestHandler } from '@sveltejs/kit';
import { jellyseerrConn, seerr, toRequest } from '$lib/server/jellyseerr';
import type { JellyseerrData } from '$lib/types';
import { apiError } from '$lib/server/api-error';

/** GET ?filter=pending|all&take=N — latest media requests plus counters. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await jellyseerrConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Jellyseerr / Overseerr' });
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
		return msg.startsWith('HTTP') ? apiError(502, 'errors.answeredHttp', { name: 'Jellyseerr', status: msg.slice(5) }) : apiError(502, 'errors.cannotReach', { name: 'Jellyseerr / Overseerr' });
	}
};
