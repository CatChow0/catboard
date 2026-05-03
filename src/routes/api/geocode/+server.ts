import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query || query.length < 2) {
		return json({ results: [] });
	}

	try {
		const res = await fetch(
			`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`,
			{ signal: AbortSignal.timeout(5000) }
		);

		if (!res.ok) {
			return json({ results: [] });
		}

		const data = await res.json();
		const results = (data.results || []).map((r: any) => ({
			name: r.name,
			latitude: r.latitude,
			longitude: r.longitude,
			country: r.country || '',
			zipcode: r.postcode || '',
			admin1: r.admin1 || ''
		}));

		return json({ results });
	} catch {
		return json({ results: [] });
	}
};