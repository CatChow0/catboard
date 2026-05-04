import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServices } from '$lib/server/config';

interface CachedStatus {
	data: Record<string, string>;
	expires: number;
}

let cache: CachedStatus | null = null;
const CACHE_TTL = 300_000; // 5 minutes

async function checkService(url: string, method: string): Promise<string> {
	try {
		const response = await fetch(url, { method, signal: AbortSignal.timeout(5000) });
		return response.ok ? 'online' : 'error';
	} catch {
		return 'offline';
	}
}

export const GET: RequestHandler = async () => {
	if (cache && cache.expires > Date.now()) {
		return json(cache.data);
	}

	const data = await getServices();
	const services = data.services.filter((s) => s.statusCheck?.enabled);

	const results = await Promise.all(
		services.map(async (s) => {
			const status = await checkService(s.url, s.statusCheck.method || 'HEAD');
			return { id: s.id, status };
		})
	);

	const map: Record<string, string> = {};
	for (const r of results) {
		map[r.id] = r.status;
	}

	cache = { data: map, expires: Date.now() + CACHE_TTL };
	return json(map);
};
