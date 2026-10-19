import { json, type RequestHandler } from '@sveltejs/kit';
import { immichConn, summary } from '$lib/server/immich';
import { apiError, errorBody } from '$lib/server/api-error';

/** GET ?photos= — library statistics and the latest photos. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await immichConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Immich' });
	const photos = Math.min(24, Math.max(0, Number(url.searchParams.get('photos')) || 0));
	try {
		return json(await summary(conn, photos), { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
