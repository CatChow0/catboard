import type { RequestHandler } from './$types';
import { getIntegrations, getLayout } from '$lib/server/config';
import type { DockerEnvironmentData, DockerContainerInfo } from '$lib/types';
import http from 'node:http';
import net from 'node:net';

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

export const GET: RequestHandler = async ({ request }) => {
	const integrations = await getIntegrations();
	const environments = integrations.docker?.environments || [];

	const layout = await getLayout();
	const envIds = new Set<string>();
	const allItems = Object.values(layout.layouts || {}).flatMap((l) => l.items || []);
	const allNavbarItems = Object.values(layout.layouts || {}).flatMap((l) => l.navbar?.items || []);

	for (const item of allItems) {
		if (item.type === 'docker' && (item as any).config?.environmentId) {
			envIds.add((item as any).config.environmentId);
		}
	}
	for (const item of allNavbarItems) {
		if (item.type === 'navbar-docker' && (item as any).config?.environmentId) {
			envIds.add((item as any).config.environmentId);
		}
	}

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const sendEvent = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			if (environments.length === 0 || envIds.size === 0) {
				sendEvent('docker-status', { environments: [] });
				try { controller.close(); } catch {}
				return;
			}

			const poll = async () => {
				for (const env of environments) {
					if (!envIds.has(env.id)) continue;
					try {
						let res;
						if (env.url.startsWith('/')) {
							res = await fetchViaSocket(env.url, '/containers/json?all=true');
						} else {
							const base = env.url.replace(/\/+$/, '').replace(/^tcp:\/\//, 'http://');
							res = await fetch(`${base}/containers/json?all=true`, { signal: AbortSignal.timeout(5000) });
						}

						if (!res.ok) continue;

						const containers: any[] = await res.json();
						const containerInfos: DockerContainerInfo[] = [];
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

							containerInfos.push({
								id: c.Id?.substring(0, 12) || '',
								name,
								status,
								image: c.Image || ''
							});
						}

						const result: DockerEnvironmentData = {
							environmentId: env.id,
							name: env.name,
							containers: containerInfos,
							runningCount,
							stoppedCount
						};

						sendEvent('docker-status', result);
					} catch {
						// skip failed environment
					}
				}
			};

			await poll();
			const interval = setInterval(poll, 30000);

			request.signal.addEventListener('abort', () => {
				clearInterval(interval);
				try { controller.close(); } catch {}
			});
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
