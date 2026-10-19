import { json, type RequestHandler } from '@sveltejs/kit';
import { psiConn, psiConfig, createUpload, isSid } from '$lib/server/psitransfer';
import { apiError, errorBody } from '$lib/server/api-error';

/**
 * POST {sid, name, size, type, retention, password} — starts sending one file
 * of a bucket; returns the id to send its chunks to (PATCH upload/[id]).
 */
export const POST: RequestHandler = async ({ request }) => {
	const conn = await psiConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'PsiTransfer' });
	const body = await request.json().catch(() => ({}));
	const sid = String(body?.sid ?? '');
	const size = Number(body?.size);
	const retention = String(body?.retention ?? '');
	if (!isSid(sid)) return apiError(400, 'errors.invalidBucket');
	if (!Number.isSafeInteger(size) || size < 0) return apiError(400, 'errors.invalidFileSize');
	try {
		const cfg = await psiConfig(conn);
		if (!(retention in cfg.retentions)) return apiError(400, 'errors.unknownRetention');
		if (cfg.requireBucketPassword && !body?.password) return apiError(400, 'errors.psiPasswordAlways');
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
		return json(errorBody(err), { status: 502 });
	}
};
