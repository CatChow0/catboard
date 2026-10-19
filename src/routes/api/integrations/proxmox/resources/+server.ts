import { json, type RequestHandler } from '@sveltejs/kit';
import { pveConn, resources } from '$lib/server/proxmox';
import { apiError, errorBody } from '$lib/server/api-error';

/** GET ?cluster= — nodes and guests of a Proxmox cluster. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await pveConn(url.searchParams.get('cluster') ?? '');
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Proxmox' });
	try {
		return json(await resources(conn), { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
