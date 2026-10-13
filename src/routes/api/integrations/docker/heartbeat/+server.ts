import type { RequestHandler } from './$types';
import { getIntegrations, getLayout } from '$lib/server/config';
import type { DockerEnvironmentData, DockerContainerInfo, DockerEnvironment } from '$lib/types';
import http from 'node:http';
import net from 'node:net';

const POLL_MS = 30000;
// Faster refresh while a widget shows CPU/RAM (one-shot stats are cheap).
const STATS_POLL_MS = 10000;

function fetchViaSocket(socketPath: string, path: string): Promise<{ ok: boolean; json(): Promise<any> }> {
	return new Promise((resolve) => {
		const req = http.request(
			{
				hostname: 'localhost',
				path,
				method: 'GET',
				createConnection: () => net.createConnection(socketPath)
			},
			(res) => {
				let body = '';
				res.on('data', (chunk) => { body += chunk; });
				res.on('end', () => {
					resolve({
						ok: res.statusCode != null && res.statusCode >= 200 && res.statusCode < 300,
						json: async () => JSON.parse(body)
					});
				});
			}
		);
		req.on('error', () => {
			resolve({ ok: false, json: async () => { throw new Error('request failed'); } });
		});
		req.setTimeout(5000, () => {
			req.destroy();
			resolve({ ok: false, json: async () => { throw new Error('timeout'); } });
		});
		req.end();
	});
}

/** GET on the Docker Engine API of an environment (unix socket or TCP/HTTP URL). */
async function dockerGet(env: DockerEnvironment, path: string): Promise<{ ok: boolean; json(): Promise<any> }> {
	if (env.url.startsWith('/')) return fetchViaSocket(env.url, path);
	const base = env.url.replace(/\/+$/, '').replace(/^tcp:\/\//, 'http://');
	return fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000) });
}

/**
 * Which environments the dashboard shows, and which of them need per-container
 * CPU/RAM. Re-read on every poll so new widgets and option changes apply
 * without reopening the stream.
 */
async function wantedEnvironments(): Promise<{ envIds: Set<string>; statsEnvIds: Set<string> }> {
	const layout = await getLayout();
	const envIds = new Set<string>();
	const statsEnvIds = new Set<string>();
	const visit = (item: any) => {
		if ((item.type === 'docker' || item.type === 'navbar-docker') && item.config?.environmentId) {
			envIds.add(item.config.environmentId);
			if (item.config.showCpu || item.config.showRam) statsEnvIds.add(item.config.environmentId);
		}
		for (const child of item.children || []) visit(child);
	};
	for (const l of Object.values(layout.layouts || {})) {
		(l.items || []).forEach(visit);
		(l.navbar?.items || []).forEach(visit);
	}
	return { envIds, statsEnvIds };
}

// Previous CPU counters per container: one-shot stats carry no "precpu"
// sample, so CPU % is computed between two readings (an average over the
// poll interval). The very first reading is followed by a second one a
// second later, so CPU shows up right away.
const lastCpu = new Map<string, { total: number; system: number; at: number }>();

async function containerStats(env: DockerEnvironment, fullId: string): Promise<Pick<DockerContainerInfo, 'cpuPercent' | 'memUsage' | 'memLimit'>> {
	try {
		const res = await dockerGet(env, `/containers/${fullId}/stats?stream=false&one-shot=true`);
		if (!res.ok) return {};
		const s = await res.json();
		const out: Pick<DockerContainerInfo, 'cpuPercent' | 'memUsage' | 'memLimit'> = {};

		// Memory as `docker stats` shows it: usage minus reclaimable page cache.
		const m = s.memory_stats;
		if (m?.usage != null) {
			const cache = m.stats?.inactive_file ?? m.stats?.total_inactive_file ?? m.stats?.cache ?? 0;
			out.memUsage = Math.max(0, m.usage - cache);
			if (m.limit) out.memLimit = m.limit;
		}

		const total = s.cpu_stats?.cpu_usage?.total_usage;
		const system = s.cpu_stats?.system_cpu_usage;
		const cpus = s.cpu_stats?.online_cpus || s.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
		if (typeof total === 'number' && typeof system === 'number') {
			const key = `${env.id}:${fullId}`;
			// Older engines ignore one-shot and include a fresh precpu sample.
			const pre = s.precpu_stats?.system_cpu_usage
				? { total: s.precpu_stats.cpu_usage.total_usage, system: s.precpu_stats.system_cpu_usage }
				: lastCpu.get(key);
			if (pre && system > pre.system) out.cpuPercent = Math.max(0, ((total - pre.total) / (system - pre.system)) * cpus * 100);
			lastCpu.set(key, { total, system, at: Date.now() });
		}
		return out;
	} catch {
		return {};
	}
}

async function pollEnvironment(env: DockerEnvironment, withStats: boolean): Promise<DockerEnvironmentData | null> {
	const res = await dockerGet(env, '/containers/json?all=true');
	if (!res.ok) return null;
	const containers: any[] = await res.json();
	const infos: DockerContainerInfo[] = [];
	let runningCount = 0;
	let stoppedCount = 0;

	for (const c of containers) {
		const name = (c.Names?.[0] || c.Id?.substring(0, 12) || 'unknown').replace(/^\//, '');
		const state: string = c.State || 'exited';
		let status: DockerContainerInfo['status'];
		if (state === 'running') { status = 'running'; runningCount++; }
		else if (state === 'paused') { status = 'paused'; stoppedCount++; }
		else if (state === 'restarting') { status = 'restarting'; stoppedCount++; }
		else if (state === 'dead') { status = 'dead'; stoppedCount++; }
		else { status = 'stopped'; stoppedCount++; }
		infos.push({ id: c.Id?.substring(0, 12) || '', name, status, image: c.Image || '' });
	}

	const result: DockerEnvironmentData = { environmentId: env.id, name: env.name, containers: infos, runningCount, stoppedCount };

	if (withStats) {
		// Forget counters of containers that are gone (not seen for 5 minutes).
		const now = Date.now();
		for (const [k, v] of lastCpu) if (now - v.at > 300_000) lastCpu.delete(k);
		const running = containers.filter((c) => c.State === 'running' && c.Id);
		const stats = await Promise.all(running.map((c) => containerStats(env, c.Id)));
		const firstSeen = running.map((_, i) => i).filter((i) => stats[i].cpuPercent == null && stats[i].memUsage != null);
		if (firstSeen.length) {
			await new Promise((r) => setTimeout(r, 1000));
			const again = await Promise.all(firstSeen.map((i) => containerStats(env, running[i].Id)));
			firstSeen.forEach((i, k) => { if (again[k].memUsage != null) stats[i] = again[k]; });
		}
		let cpu = 0;
		let mem = 0;
		running.forEach((c, i) => {
			const info = infos.find((x) => x.id === c.Id.substring(0, 12));
			if (!info) return;
			Object.assign(info, stats[i]);
			cpu += stats[i].cpuPercent ?? 0;
			mem += stats[i].memUsage ?? 0;
		});
		result.stats = { cpuPercent: cpu, memUsage: mem };
	}
	return result;
}

export const GET: RequestHandler = async ({ request }) => {
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			let closed = false;
			const sendEvent = (event: string, data: unknown) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				} catch {
					closed = true;
				}
			};

			const poll = async (): Promise<boolean> => {
				try {
					const [integrations, wanted] = await Promise.all([getIntegrations(), wantedEnvironments()]);
					const environments = (integrations.docker?.environments || []).filter((e) => wanted.envIds.has(e.id));
					await Promise.all(
						environments.map(async (env) => {
							try {
								const data = await pollEnvironment(env, wanted.statsEnvIds.has(env.id));
								if (data) sendEvent('docker-status', data);
							} catch {
								// skip failed environment
							}
						})
					);
					return environments.some((e) => wanted.statsEnvIds.has(e.id));
				} catch {
					// skip failed poll
					return false;
				}
			};

			// Re-armed after each poll: the delay depends on whether stats are shown.
			let timer: ReturnType<typeof setTimeout> | undefined;
			request.signal.addEventListener('abort', () => {
				closed = true;
				clearTimeout(timer);
				try { controller.close(); } catch {}
			});
			const loop = async () => {
				if (closed) return;
				const withStats = await poll();
				if (!closed) timer = setTimeout(loop, withStats ? STATS_POLL_MS : POLL_MS);
			};
			await loop();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
