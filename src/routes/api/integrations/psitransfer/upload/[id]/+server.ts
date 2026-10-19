import { json, type RequestHandler } from '@sveltejs/kit';
import { psiConn, appendChunk } from '$lib/server/psitransfer';
import { apiError, errorBody } from '$lib/server/api-error';

const MAX_CHUNK = 1024 * 1024;

/** PATCH (Upload-Offset header, raw bytes) — one piece of a file; returns the new offset. */
export const PATCH: RequestHandler = async ({ request, params }) => {
	const conn = await psiConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'PsiTransfer' });
	const offset = Number(request.headers.get('upload-offset'));
	if (!Number.isSafeInteger(offset) || offset < 0) return apiError(400, 'errors.missingOffset');
	const chunk = await request.arrayBuffer();
	if (chunk.byteLength > MAX_CHUNK) return apiError(413, 'errors.chunkTooLarge');
	try {
		return json({ offset: await appendChunk(conn, params.id ?? '', offset, chunk) });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
