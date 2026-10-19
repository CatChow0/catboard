import { json, type RequestHandler } from '@sveltejs/kit';
import { qbitConn, qbit, toTorrent } from '$lib/server/qbittorrent';
import type { QBittorrentData, TorrentState } from '$lib/types';
import { apiError, errorBody } from '$lib/server/api-error';

const FILTERS = new Set(['active', 'all', 'downloading', 'seeding']);

/** GET ?filter=active|all|downloading|seeding&limit=N — speeds, counters and torrents. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await qbitConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'qBittorrent' });
	const filter = FILTERS.has(url.searchParams.get('filter') || '') ? url.searchParams.get('filter')! : 'active';
	const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '8', 10) || 8, 1), 50);
	try {
		const [infoRes, listRes] = await Promise.all([qbit(conn, '/transfer/info'), qbit(conn, '/torrents/info?sort=added_on&reverse=true')]);
		if (!infoRes.ok || !listRes.ok) return json({ error: `qBittorrent answered HTTP ${infoRes.ok ? listRes.status : infoRes.status}` }, { status: 502 });
		const info = await infoRes.json();
		const all = ((await listRes.json()) as Record<string, unknown>[]).map(toTorrent);

		const counts = { downloading: 0, seeding: 0, paused: 0, queued: 0, checking: 0, stalled: 0, error: 0, completed: 0 } as Record<TorrentState, number>;
		for (const t of all) counts[t.state]++;

		const shown = all
			.filter((t) =>
				filter === 'all' ? true
				: filter === 'downloading' ? ['downloading', 'stalled', 'queued', 'checking'].includes(t.state) && t.progress < 1
				: filter === 'seeding' ? t.state === 'seeding'
				: t.dlSpeed > 0 || t.upSpeed > 0 || t.state === 'downloading' || t.state === 'checking'
			)
			// Busiest first, then newest (the list arrives newest first).
			.sort((a, b) => b.dlSpeed + b.upSpeed - (a.dlSpeed + a.upSpeed))
			.slice(0, limit);

		const data: QBittorrentData = { dlSpeed: info.dl_info_speed ?? 0, upSpeed: info.up_info_speed ?? 0, counts, total: all.length, torrents: shown };
		return json(data, { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		const msg = err instanceof Error ? err.message : '';
		const known = msg.startsWith('Wrong') || msg.startsWith('qBittorrent');
		return known ? json(errorBody(err), { status: 502 }) : apiError(502, 'errors.cannotReach', { name: 'qBittorrent' });
	}
};
