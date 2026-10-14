import { json, type RequestHandler } from '@sveltejs/kit';
import { spoolmanUrl, spoolmanData } from '$lib/server/spoolman';

const num = (v: string | null, def: number, min: number, max: number) => {
	const n = Number(v);
	return v != null && v !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** GET ?limit=N&lowPercent=15&lowGrams=0&archived=0&sort=name|remaining|lastUsed — recently used, running low and empty spools. */
export const GET: RequestHandler = async ({ url }) => {
	const base = await spoolmanUrl();
	if (!base) return json({ error: 'Spoolman not configured' }, { status: 404 });
	const q = url.searchParams;
	try {
		const data = await spoolmanData(base, {
			limit: num(q.get('limit'), 6, 1, 50),
			lowPercent: num(q.get('lowPercent'), 15, 0, 100),
			lowGrams: num(q.get('lowGrams'), 0, 0, 100000),
			includeArchived: q.get('archived') === '1',
			sort: q.get('sort') === 'remaining' || q.get('sort') === 'lastUsed' ? (q.get('sort') as 'remaining' | 'lastUsed') : 'name'
		});
		return json(data, { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		const msg = err instanceof Error ? err.message : '';
		return json({ error: msg.startsWith('Spoolman') || msg.startsWith('Not a') ? msg : 'Cannot reach Spoolman' }, { status: 502 });
	}
};
