import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { jenkinsConn, startBuild } from '$lib/server/jenkins';
import { apiError, errorBody } from '$lib/server/api-error';

/** POST {job, params?} — queue a build (admins). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const conn = await jenkinsConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Jenkins' });
	const body = await request.json().catch(() => ({}));
	const job = String(body?.job ?? '').trim();
	if (!job) return apiError(400, 'errors.missingJob');
	const params: Record<string, string | boolean> = {};
	if (body?.params && typeof body.params === 'object') {
		for (const [k, v] of Object.entries(body.params)) if (typeof v === 'string' || typeof v === 'boolean') params[k] = v;
	}
	try {
		await startBuild(conn, job, params);
		return json({ ok: true });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
