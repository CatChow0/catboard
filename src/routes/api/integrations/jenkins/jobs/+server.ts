import { json, type RequestHandler } from '@sveltejs/kit';
import { jenkinsConn, listJobs } from '$lib/server/jenkins';
import { apiError, errorBody } from '$lib/server/api-error';

/** GET — every job (full names, folders joined with "/"), for the widget's project picker. */
export const GET: RequestHandler = async () => {
	const conn = await jenkinsConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Jenkins' });
	try {
		return json({ jobs: await listJobs(conn) });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
