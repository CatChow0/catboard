import { json, type RequestHandler } from '@sveltejs/kit';
import { psiConn, appendChunk } from '$lib/server/psitransfer';

const MAX_CHUNK = 1024 * 1024;

/** PATCH (Upload-Offset header, raw bytes) — one piece of a file; returns the new offset. */
export const PATCH: RequestHandler = async ({ request, params }) => {
	const conn = await psiConn();
	if (!conn) return json({ error: 'PsiTransfer is not set up' }, { status: 404 });
	const offset = Number(request.headers.get('upload-offset'));
	if (!Number.isSafeInteger(offset) || offset < 0) return json({ error: 'Missing Upload-Offset' }, { status: 400 });
	const chunk = await request.arrayBuffer();
	if (chunk.byteLength > MAX_CHUNK) return json({ error: 'Chunk too large' }, { status: 413 });
	try {
		return json({ offset: await appendChunk(conn, params.id ?? '', offset, chunk) });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
