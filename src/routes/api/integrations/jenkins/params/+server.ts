import { json, type RequestHandler } from '@sveltejs/kit';
import { jenkinsConn, jobParameters } from '$lib/server/jenkins';
import { apiError, errorBody } from '$lib/server/api-error';

/** GET ?job= — parameters of a job (type, default, choices), for the Run form. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await jenkinsConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Jenkins' });
	const job = (url.searchParams.get('job') || '').trim();
	if (!job) return apiError(400, 'errors.missingJob');
	try {
		return json({ parameters: await jobParameters(conn, job) });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
