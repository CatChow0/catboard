import { json, type RequestHandler } from '@sveltejs/kit';
import { jenkinsConn, jobParameters } from '$lib/server/jenkins';

/** GET ?job= — parameters of a job (type, default, choices), for the Run form. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await jenkinsConn();
	if (!conn) return json({ error: 'Jenkins is not set up' }, { status: 404 });
	const job = (url.searchParams.get('job') || '').trim();
	if (!job) return json({ error: 'Missing job' }, { status: 400 });
	try {
		return json({ parameters: await jobParameters(conn, job) });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
