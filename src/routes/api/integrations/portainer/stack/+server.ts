import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { portainerConn, stackAction } from '$lib/server/portainer';
import { apiError, errorBody } from '$lib/server/api-error';

/** POST {id, endpointId, action: 'start' | 'stop'} — start or stop a stack (admins). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const conn = await portainerConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Portainer' });
	const body = await request.json().catch(() => ({}));
	const id = Number(body?.id);
	const endpointId = Number(body?.endpointId);
	const action = body?.action;
	if (!Number.isInteger(id) || !Number.isInteger(endpointId) || (action !== 'start' && action !== 'stop')) {
		return apiError(400, 'errors.invalidStack');
	}
	try {
		await stackAction(conn, id, endpointId, action);
		return json({ ok: true });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
