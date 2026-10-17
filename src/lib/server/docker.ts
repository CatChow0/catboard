// Docker Engine API access for an environment: a unix socket path or a
// TCP/HTTP URL. Used by the heartbeat stream and the connection test.
import http from 'node:http';
import net from 'node:net';
import type { DockerEnvironment } from '$lib/types';

type DockerResponse = { ok: boolean; status: number; json(): Promise<any>; text(): Promise<string> };

function fetchViaSocket(socketPath: string, path: string): Promise<DockerResponse> {
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
						status: res.statusCode ?? 0,
						json: async () => JSON.parse(body),
						text: async () => body
					});
				});
			}
		);
		req.on('error', (err) => {
			resolve({ ok: false, status: 0, json: async () => { throw new Error('request failed'); }, text: async () => err.message });
		});
		req.setTimeout(5000, () => {
			req.destroy();
			resolve({ ok: false, status: 0, json: async () => { throw new Error('timeout'); }, text: async () => '' });
		});
		req.end();
	});
}

/** GET on the Docker Engine API of an environment (unix socket or TCP/HTTP URL). */
export async function dockerGet(env: DockerEnvironment, path: string): Promise<DockerResponse> {
	if (env.url.startsWith('/')) return fetchViaSocket(env.url, path);
	const base = env.url.replace(/\/+$/, '').replace(/^tcp:\/\//, 'http://');
	return fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000) });
}
