import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCacheStats, clearCache, resolveIcon } from '$lib/server/icon-cache';
import { getServices } from '$lib/server/config';
import { requireAdmin } from '$lib/server/auth';

export const GET: RequestHandler = async () => {
	return json(await getCacheStats());
};

export const DELETE: RequestHandler = async ({ locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	return json({ cleared: await clearCache() });
};

/** POST — clear the cache, then resolve every service's icon again (warms it up). */
export const POST: RequestHandler = async ({ locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	await clearCache();
	const { services } = await getServices();
	let rebuilt = 0;
	const errors: string[] = [];
	await Promise.allSettled(
		services.map(async (s) => {
			const entry = await resolveIcon(s.icon || '', s.name || '', s.url || '').catch(() => null);
			if (entry) rebuilt++;
			else errors.push(s.name);
		})
	);
	return json({ rebuilt, errors });
};
