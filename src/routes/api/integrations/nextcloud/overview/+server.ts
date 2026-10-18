import { json, type RequestHandler } from '@sveltejs/kit';
import { nextcloudConn, overview } from '$lib/server/nextcloud';

/** GET ?server=1&files=N — quota, server info (admins of Nextcloud) and recent files. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await nextcloudConn();
	if (!conn) return json({ error: 'Nextcloud is not set up' }, { status: 404 });
	const files = Math.min(20, Math.max(0, Number(url.searchParams.get('files')) || 0));
	try {
		return json(await overview(conn, { server: url.searchParams.get('server') === '1', files }), { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
