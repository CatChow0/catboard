import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCacheStats, clearCache, fetchAndCacheIcon } from '$lib/server/icon-cache';
import { getServices } from '$lib/server/config';

export const GET: RequestHandler = async () => {
	const stats = await getCacheStats();
	return json(stats);
};

export const DELETE: RequestHandler = async () => {
	const count = await clearCache();
	return json({ cleared: count });
};

export const POST: RequestHandler = async () => {
	await clearCache();
	const { services } = await getServices();
	let rebuilt = 0;
	const errors: string[] = [];

	await Promise.allSettled(
		services.map(async (s) => {
			if (!s.url) return;
			try {
				const entry = await fetchAndCacheIcon(s.url);
				if (entry) rebuilt++;
				else errors.push(s.name);
			} catch {
				errors.push(s.name);
			}
		})
	);

	return json({ rebuilt, errors });
};