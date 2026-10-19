import { json, type RequestHandler } from '@sveltejs/kit';
import { portainerConn, overview } from '$lib/server/portainer';
import { apiError, errorBody } from '$lib/server/api-error';

/** GET — Portainer environments (container counts) and stacks. */
export const GET: RequestHandler = async () => {
	const conn = await portainerConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Portainer' });
	try {
		return json(await overview(conn), { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
