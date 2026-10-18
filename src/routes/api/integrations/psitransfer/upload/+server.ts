import { json, type RequestHandler } from '@sveltejs/kit';
import { psiConn, psiConfig, createUpload, isSid } from '$lib/server/psitransfer';

/**
 * POST {sid, name, size, type, retention, password} — starts sending one file
 * of a bucket; returns the id to send its chunks to (PATCH upload/[id]).
 */
export const POST: RequestHandler = async ({ request }) => {
	const conn = await psiConn();
	if (!conn) return json({ error: 'PsiTransfer is not set up' }, { status: 404 });
	const body = await request.json().catch(() => ({}));
	const sid = String(body?.sid ?? '');
	const size = Number(body?.size);
	const retention = String(body?.retention ?? '');
	if (!isSid(sid)) return json({ error: 'Invalid bucket id' }, { status: 400 });
	if (!Number.isSafeInteger(size) || size < 0) return json({ error: 'Invalid file size' }, { status: 400 });
	try {
		const cfg = await psiConfig(conn);
		if (!(retention in cfg.retentions)) return json({ error: 'Unknown retention' }, { status: 400 });
		if (cfg.requireBucketPassword && !body?.password) return json({ error: 'This PsiTransfer requires a password for every upload' }, { status: 400 });
		const id = await createUpload(conn, {
			sid,
			name: String(body?.name ?? 'file'),
			size,
			type: String(body?.type ?? ''),
			retention,
			password: String(body?.password ?? '')
		});
		return json({ id });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
