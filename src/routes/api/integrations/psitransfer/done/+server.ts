import { json, type RequestHandler } from '@sveltejs/kit';
import { psiConn, lockBucket, isSid } from '$lib/server/psitransfer';

/** POST {sid} — every file is sent: close the bucket and return its share link. */
export const POST: RequestHandler = async ({ request }) => {
	const conn = await psiConn();
	if (!conn) return json({ error: 'PsiTransfer is not set up' }, { status: 404 });
	const sid = String((await request.json().catch(() => ({})))?.sid ?? '');
	if (!isSid(sid)) return json({ error: 'Invalid bucket id' }, { status: 400 });
	try {
		await lockBucket(conn, sid);
	} catch {
		// The files are there; an unlocked bucket only means more files could be added.
	}
	return json({ url: `${conn.publicBase}/${sid}` });
};
