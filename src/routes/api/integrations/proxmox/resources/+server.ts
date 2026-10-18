import { json, type RequestHandler } from '@sveltejs/kit';
import { pveConn, resources } from '$lib/server/proxmox';

/** GET ?cluster= — nodes and guests of a Proxmox cluster. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await pveConn(url.searchParams.get('cluster') ?? '');
	if (!conn) return json({ error: 'Proxmox is not set up' }, { status: 404 });
	try {
		return json(await resources(conn), { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
