import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { fetchArrEntries } from '$lib/server/arr';

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
	const n = parseInt(value || '', 10);
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export const GET: RequestHandler = async ({ url }) => {
	const sources = (url.searchParams.get('sources') || '').split(',').filter(Boolean);
	const days = clampInt(url.searchParams.get('days'), 14, 1, 90);
	const limit = clampInt(url.searchParams.get('limit'), 10, 1, 50);
	const onlyDownloaded = url.searchParams.get('onlyDownloaded') === 'true';

	if (sources.length === 0) {
		return json({ entries: [], updatedAt: Date.now(), errors: [] });
	}

	const now = new Date();
	const today = now.toISOString().split('T')[0];
	const start = new Date(now.getTime() - days * 86_400_000).toISOString().split('T')[0];
	// Calendar `end` is exclusive on some *Arr versions, so ask one day past today
	const end = new Date(now.getTime() + 86_400_000).toISOString().split('T')[0];

	const includeFeatures = url.searchParams.get('includeFeatures') === 'true';
	const { entries, errors } = await fetchArrEntries(sources, start, end, 'released', { includeFeatures });

	const released = entries
		.filter((e) => e.date >= start && e.date <= today && (!onlyDownloaded || e.hasFile))
		.sort((a, b) => b.date.localeCompare(a.date))
		.slice(0, limit);

	return json(
		{ entries: released, updatedAt: Date.now(), errors },
		{ headers: { 'Cache-Control': 'max-age=60' } }
	);
};
