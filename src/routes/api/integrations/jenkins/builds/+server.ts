import { json, type RequestHandler } from '@sveltejs/kit';
import { jenkinsConn, recentBuilds } from '$lib/server/jenkins';

/** GET ?job=&limit= — latest builds of a job, or of every job when job is empty. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await jenkinsConn();
	if (!conn) return json({ error: 'Jenkins is not set up' }, { status: 404 });
	const job = (url.searchParams.get('job') || '').trim();
	const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 8));
	try {
		return json(await recentBuilds(conn, job, limit), { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
