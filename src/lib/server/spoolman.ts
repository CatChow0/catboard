// Spoolman client: reads every spool once (homelabs have a few dozen) and
// sorts them into recently used, running low and empty lists.
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import type { SpoolInfo, SpoolmanData } from '$lib/types';

const CACHE_MS = 30_000;
let cache: { key: string; at: number; spools: SpoolInfo[] } | null = null;

export async function spoolmanUrl(): Promise<string | null> {
	const c = (await getIntegrations()).spoolman;
	return c?.url ? normalizeUrl(c.url) : null;
}

/** Spoolman stores colours as "RRGGBB" (or "RRGGBBAA"), several comma-separated for multi-colour filaments. */
function colors(f: Record<string, any>): string[] {
	const raw: string = f.multi_color_hexes || f.color_hex || '';
	return raw
		.split(',')
		.map((h) => h.trim().replace(/^#/, ''))
		.filter((h) => /^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h))
		.map((h) => '#' + h.slice(0, 6));
}

export function toSpool(s: Record<string, any>): SpoolInfo {
	const f = s.filament || {};
	const remaining = typeof s.remaining_weight === 'number' ? s.remaining_weight : null;
	const initial = typeof s.initial_weight === 'number' ? s.initial_weight : typeof f.weight === 'number' ? f.weight : null;
	return {
		id: s.id,
		name: f.name || `Spool #${s.id}`,
		vendor: f.vendor?.name || '',
		material: f.material || '',
		colors: colors(f),
		remaining,
		initial,
		percent: remaining != null && initial ? Math.max(0, Math.min(100, (remaining / initial) * 100)) : null,
		lastUsed: s.last_used || null,
		location: s.location || '',
		archived: !!s.archived
	};
}

async function allSpools(base: string, includeArchived: boolean): Promise<SpoolInfo[]> {
	const key = `${base}|${includeArchived}`;
	if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.spools;
	const res = await fetch(`${base}/api/v1/spool?allow_archived=${includeArchived}`, { signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`Spoolman answered HTTP ${res.status}`);
	const ct = res.headers.get('content-type') || '';
	if (!ct.includes('json')) throw new Error('Not a Spoolman API (check the URL)');
	const spools = ((await res.json()) as Record<string, any>[]).map(toSpool);
	cache = { key, at: Date.now(), spools };
	return spools;
}

export async function spoolmanData(base: string, opts: { limit: number; lowPercent: number; lowGrams: number; includeArchived: boolean }): Promise<SpoolmanData> {
	const spools = await allSpools(base, opts.includeArchived);
	const isEmpty = (s: SpoolInfo) => s.remaining != null && s.remaining <= 1;
	const isLow = (s: SpoolInfo) =>
		!isEmpty(s) && !s.archived && s.remaining != null && ((s.percent != null && s.percent <= opts.lowPercent) || (opts.lowGrams > 0 && s.remaining <= opts.lowGrams));

	const recent = spools
		.filter((s) => s.lastUsed && !s.archived)
		.sort((a, b) => Date.parse(b.lastUsed!) - Date.parse(a.lastUsed!))
		.slice(0, opts.limit);
	const low = spools.filter(isLow).sort((a, b) => (a.remaining ?? 0) - (b.remaining ?? 0));
	// Archived spools are usually the finished ones; only listed when asked for.
	const empty = spools.filter((s) => isEmpty(s) && (opts.includeArchived || !s.archived)).sort((a, b) => Date.parse(b.lastUsed || '0') - Date.parse(a.lastUsed || '0'));
	return { url: base, recent, low: low.slice(0, opts.limit), empty: empty.slice(0, opts.limit), total: spools.length };
}
