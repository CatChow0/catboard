import { json, type RequestHandler } from '@sveltejs/kit';
import { getAccess, setAccess } from '$lib/server/config';
import { requireAdmin } from '$lib/server/auth';

/** GET / PUT {dashboardEditors: 'admins' | 'everyone'} — who may change the dashboards (admins). */
export const GET: RequestHandler = async ({ locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	return json(await getAccess());
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const body = await request.json().catch(() => ({}));
	if (body?.dashboardEditors !== 'admins' && body?.dashboardEditors !== 'everyone') {
		return json({ error: "dashboardEditors must be 'admins' or 'everyone'" }, { status: 400 });
	}
	await setAccess({ dashboardEditors: body.dashboardEditors });
	return json({ ok: true });
};
