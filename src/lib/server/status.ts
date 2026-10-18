// Service status checks shared by every viewer: results are kept for the
// reader's check interval, checks already running are joined instead of
// probing every service a second time, and at most PARALLEL probes run at once.
import type { Service } from '$lib/types';

export const MIN_TTL = 10_000;
export const MAX_TTL = 600_000;
export const PARALLEL = 8;

export type StatusMap = Record<string, string>;

export async function checkService(url: string, method: string): Promise<string> {
	try {
		const response = await fetch(url, { method, signal: AbortSignal.timeout(5000) });
		return response.ok ? 'online' : 'error';
	} catch {
		return 'offline';
	}
}

/** Probes every service with a status check, PARALLEL at a time. */
export async function checkAll(services: Service[], parallel = PARALLEL): Promise<StatusMap> {
	const queue = services.filter((s) => s.statusCheck?.enabled);
	const map: StatusMap = {};
	const worker = async () => {
		for (let s = queue.shift(); s; s = queue.shift()) {
			map[s.id] = await checkService(s.url, s.statusCheck.method || 'HEAD');
		}
	};
	await Promise.all(Array.from({ length: parallel }, worker));
	return map;
}

/** Interval in ms clamped to what the cache accepts (30 s when unset). */
export const statusTtl = (interval: unknown) => Math.min(MAX_TTL, Math.max(MIN_TTL, Number(interval) || 30_000));

/** A cache of the last results with in-flight de-duplication. */
export function statusCache(load: () => Promise<StatusMap>, now = () => Date.now()) {
	let cache: { data: StatusMap; at: number } | null = null;
	let running: Promise<StatusMap> | null = null;
	return async function get(ttl: number): Promise<StatusMap> {
		if (cache && now() - cache.at < ttl) return cache.data;
		running ??= load()
			.then((data) => {
				cache = { data, at: now() };
				return data;
			})
			.finally(() => (running = null));
		return running;
	};
}
