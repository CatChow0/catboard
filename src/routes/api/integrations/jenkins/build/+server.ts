import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { jenkinsConn, startBuild } from '$lib/server/jenkins';

/** POST {job, params?} — queue a build (admins). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const conn = await jenkinsConn();
	if (!conn) return json({ error: 'Jenkins is not set up' }, { status: 404 });
	const body = await request.json().catch(() => ({}));
	const job = String(body?.job ?? '').trim();
	if (!job) return json({ error: 'Missing job' }, { status: 400 });
	const params: Record<string, string | boolean> = {};
	if (body?.params && typeof body.params === 'object') {
		for (const [k, v] of Object.entries(body.params)) if (typeof v === 'string' || typeof v === 'boolean') params[k] = v;
	}
	try {
		await startBuild(conn, job, params);
		return json({ ok: true });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
