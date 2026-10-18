import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServices, getSettingsForUser } from '$lib/server/config';

// Results are shared by every viewer and kept for the reader's check interval
// (Settings statusCheckInterval, 10 s to 10 min). Checks already running are
// joined instead of probing every service a second time.
const MIN_TTL = 10_000;
const MAX_TTL = 600_000;
const PARALLEL = 8;

let cache: { data: Record<string, string>; at: number } | null = null;
let running: Promise<Record<string, string>> | null = null;

async function checkService(url: string, method: string): Promise<string> {
	try {
		const response = await fetch(url, { method, signal: AbortSignal.timeout(5000) });
		return response.ok ? 'online' : 'error';
	} catch {
		return 'offline';
	}
}

async function checkAll(): Promise<Record<string, string>> {
	const data = await getServices();
	const queue = data.services.filter((s) => s.statusCheck?.enabled);
	const map: Record<string, string> = {};
	const worker = async () => {
		for (let s = queue.shift(); s; s = queue.shift()) {
			map[s.id] = await checkService(s.url, s.statusCheck.method || 'HEAD');
		}
	};
	await Promise.all(Array.from({ length: PARALLEL }, worker));
	return map;
}

export const GET: RequestHandler = async ({ locals }) => {
	const interval = locals.username ? (await getSettingsForUser(locals.username)).statusCheckInterval : undefined;
	const ttl = Math.min(MAX_TTL, Math.max(MIN_TTL, Number(interval) || 30_000));
	if (cache && Date.now() - cache.at < ttl) return json(cache.data);

	running ??= checkAll()
		.then((data) => {
			cache = { data, at: Date.now() };
			return data;
		})
		.finally(() => (running = null));
	return json(await running);
};
