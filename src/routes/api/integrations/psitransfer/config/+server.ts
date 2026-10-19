import { json, type RequestHandler } from '@sveltejs/kit';
import { psiConn, psiConfig } from '$lib/server/psitransfer';
import { apiError, errorBody } from '$lib/server/api-error';

/** Size of the pieces the widget sends (below adapter-node's default 512 KB body limit). */
const CHUNK_SIZE = 384 * 1024;

/** GET — retentions, size limits and link base of the PsiTransfer connection (any signed-in user). */
export const GET: RequestHandler = async () => {
	const conn = await psiConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'PsiTransfer' });
	try {
		const config = await psiConfig(conn);
		return json({ ...config, linkBase: conn.publicBase, chunkSize: CHUNK_SIZE }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
