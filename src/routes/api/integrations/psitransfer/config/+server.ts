import { json, type RequestHandler } from '@sveltejs/kit';
import { psiConn, psiConfig } from '$lib/server/psitransfer';

/** Size of the pieces the widget sends (below adapter-node's default 512 KB body limit). */
const CHUNK_SIZE = 384 * 1024;

/** GET — retentions, size limits and link base of the PsiTransfer connection (any signed-in user). */
export const GET: RequestHandler = async () => {
	const conn = await psiConn();
	if (!conn) return json({ error: 'PsiTransfer is not set up' }, { status: 404 });
	try {
		const config = await psiConfig(conn);
		return json({ ...config, linkBase: conn.publicBase, chunkSize: CHUNK_SIZE }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
