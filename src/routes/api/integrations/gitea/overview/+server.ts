import { json, type RequestHandler } from '@sveltejs/kit';
import { giteaConn, overview } from '$lib/server/gitea';
import { apiError, errorBody } from '$lib/server/api-error';

/** GET ?repos=N&issues=N — recent repositories and open issues / pull requests. */
export const GET: RequestHandler = async ({ url }) => {
	const conn = await giteaConn();
	if (!conn) return apiError(404, 'errors.notSetUp', { name: 'Gitea' });
	const count = (k: string) => Math.min(20, Math.max(0, Number(url.searchParams.get(k)) || 0));
	try {
		return json(await overview(conn, { repos: count('repos'), issues: count('issues') }), { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		return json(errorBody(err), { status: 502 });
	}
};
