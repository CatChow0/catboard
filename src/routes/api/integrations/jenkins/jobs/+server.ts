import { json, type RequestHandler } from '@sveltejs/kit';
import { jenkinsConn, listJobs } from '$lib/server/jenkins';

/** GET — every job (full names, folders joined with "/"), for the widget's project picker. */
export const GET: RequestHandler = async () => {
	const conn = await jenkinsConn();
	if (!conn) return json({ error: 'Jenkins is not set up' }, { status: 404 });
	try {
		return json({ jobs: await listJobs(conn) });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
