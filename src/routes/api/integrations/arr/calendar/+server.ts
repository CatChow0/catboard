import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { fetchArrEntries } from '$lib/server/arr';

export const GET: RequestHandler = async ({ url }) => {
	const sourcesParam = url.searchParams.get('sources') || '';
	const start = url.searchParams.get('start') || '';
	const end = url.searchParams.get('end') || '';

	if (!sourcesParam || !start || !end) {
		return json({ entries: [], updatedAt: Date.now(), errors: [] });
	}

	const sources = sourcesParam.split(',').filter(Boolean);
	const { entries, errors } = await fetchArrEntries(sources, start, end, 'calendar');

	return json({
		entries: entries.sort((a, b) => a.date.localeCompare(b.date)),
		updatedAt: Date.now(),
		errors
	});
};
