import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { jellyseerrConn, seerr } from '$lib/server/jellyseerr';

/** POST { action: 'approve' | 'decline' } — admins only. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const id = Number(params.id);
	const body = await request.json().catch(() => ({}));
	const action = body?.action;
	if (!Number.isInteger(id) || id <= 0 || (action !== 'approve' && action !== 'decline')) {
		return json({ error: 'Bad request' }, { status: 400 });
	}
	const conn = await jellyseerrConn();
	if (!conn) return json({ error: 'Jellyseerr / Overseerr not configured' }, { status: 404 });
	try {
		await seerr(conn, `/request/${id}/${action}`, { method: 'POST', body: '{}' });
		return json({ ok: true });
	} catch (err) {
		return json({ error: `Jellyseerr refused: ${err instanceof Error ? err.message : 'error'}` }, { status: 502 });
	}
};
