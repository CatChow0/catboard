import { json, type RequestHandler } from '@sveltejs/kit';
import { immichConn, summary } from '$lib/server/immich';

/** GET ?photos= — library statistics and the latest photos. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await immichConn();
	if (!conn) return json({ error: 'Immich is not set up' }, { status: 404 });
	const photos = Math.min(24, Math.max(0, Number(url.searchParams.get('photos')) || 0));
	try {
		return json(await summary(conn, photos), { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
