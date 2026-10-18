import { json, type RequestHandler } from '@sveltejs/kit';
import { portainerConn, overview } from '$lib/server/portainer';

/** GET — Portainer environments (container counts) and stacks. */
export const GET: RequestHandler = async () => {
	const conn = await portainerConn();
	if (!conn) return json({ error: 'Portainer is not set up' }, { status: 404 });
	try {
		return json(await overview(conn), { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
