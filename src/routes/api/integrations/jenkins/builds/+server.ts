import { json, type RequestHandler } from '@sveltejs/kit';
import { jenkinsConn, recentBuilds } from '$lib/server/jenkins';
import { apiError, errorBody } from '$lib/server/api-error';

/** GET ?job=&limit= — latest builds of a job, or of every job when job is empty. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await jenkinsConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Jenkins' });
	const job = (url.searchParams.get('job') || '').trim();
	const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 8));
	try {
		return json(await recentBuilds(conn, job, limit), { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
