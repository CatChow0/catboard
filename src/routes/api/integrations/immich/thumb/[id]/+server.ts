import { error, type RequestHandler } from '@sveltejs/kit';
import { immichConn, immich, isAssetId } from '$lib/server/immich';

/** GET — a photo thumbnail, fetched with the server's API key. */
export const GET: RequestHandler = async ({ params }) => {
	const conn = await immichConn();
	if (!conn) error(404, 'Immich is not set up');
	if (!isAssetId(params.id ?? '')) error(400, 'Invalid asset id');
	const res = await immich(conn, `/assets/${params.id}/thumbnail?size=thumbnail`, { headers: { Accept: 'image/*' } });
	if (!res.ok || !res.body) error(res.status === 404 ? 404 : 502, 'Thumbnail not available');
	const type = res.headers.get('content-type') ?? '';
	if (!type.startsWith('image/')) error(502, 'Immich did not send an image');
	return new Response(res.body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' } });
};
