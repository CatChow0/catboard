import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { qbitConn, setPaused } from '$lib/server/qbittorrent';

/** POST { action: 'pause' | 'resume', hashes: string[] | 'all' } — admins only. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const body = await request.json().catch(() => ({}));
	const action = body?.action;
	const hashes = body?.hashes;
	const valid = hashes === 'all' || (Array.isArray(hashes) && hashes.length > 0 && hashes.length <= 200 && hashes.every((h) => typeof h === 'string' && /^[a-f0-9]{40}$/i.test(h)));
	if ((action !== 'pause' && action !== 'resume') || !valid) return json({ error: 'Bad request' }, { status: 400 });

	const conn = await qbitConn();
	if (!conn) return json({ error: 'qBittorrent not configured' }, { status: 404 });
	try {
		await setPaused(conn, hashes === 'all' ? 'all' : (hashes as string[]).join('|'), action === 'pause');
		return json({ ok: true });
	} catch (err) {
		return json({ error: `qBittorrent refused: ${err instanceof Error ? err.message : 'error'}` }, { status: 502 });
	}
};
