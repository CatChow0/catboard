import { json, type RequestHandler } from '@sveltejs/kit';
import { psiConn, lockBucket, isSid } from '$lib/server/psitransfer';
import { apiError } from '$lib/server/api-error';

/** POST {sid} — every file is sent: close the bucket and return its share link. */
export const POST: RequestHandler = async ({ request }) => {
	const conn = await psiConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'PsiTransfer' });
	const sid = String((await request.json().catch(() => ({})))?.sid ?? '');
	if (!isSid(sid)) return apiError(400, 'errors.invalidBucket');
	try {
		await lockBucket(conn, sid);
	} catch {
		// The files are there; an unlocked bucket only means more files could be added.
	}
	return json({ url: `${conn.publicBase}/${sid}` });
};
