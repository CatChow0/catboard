import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { jellyseerrConn, seerr } from '$lib/server/jellyseerr';
import { apiError } from '$lib/server/api-error';

/** POST { action: 'approve' | 'decline' } — admins only. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const id = Number(params.id);
	const body = await request.json().catch(() => ({}));
	const action = body?.action;
	if (!Number.isInteger(id) || id <= 0 || (action !== 'approve' && action !== 'decline')) {
		return apiError(400, 'errors.badRequest');
	}
	const conn = await jellyseerrConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Jellyseerr / Overseerr' });
	try {
		await seerr(conn, `/request/${id}/${action}`, { method: 'POST', body: '{}' });
		return json({ ok: true });
	} catch (err) {
		return apiError(502, 'errors.refused', { name: 'Jellyseerr', reason: err instanceof Error ? err.message : 'error' });
	}
};
