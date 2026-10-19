// Portainer client: access token in X-API-Key. Environments carry their last
// snapshot (container counts), so the widget needs two calls.
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import { httpFetch, isOn } from '$lib/server/http';
import type { PortainerData, PortainerEndpoint, PortainerStack } from '$lib/types';
import { AppError } from '$lib/server/api-error';

const TIMEOUT_MS = 10_000;
// Stopping a stack waits for its containers (up to 10 s each to exit).
const ACTION_TIMEOUT_MS = 90_000;

export type PortainerConn = { base: string; publicBase: string; apiKey: string; insecure: boolean };

export async function portainerConn(): Promise<PortainerConn | null> {
	const c = (await getIntegrations()).portainer;
	if (!c?.url) return null;
	return { base: normalizeUrl(c.url), publicBase: normalizeUrl(c.publicUrl || c.url), apiKey: c.apiKey ?? '', insecure: isOn(c.insecure) };
}

export async function portainer(conn: PortainerConn, path: string, init: RequestInit = {}, timeout = TIMEOUT_MS): Promise<Response> {
	const res = await httpFetch(`${conn.base}/api${path}`, {
		...init,
		insecure: conn.insecure,
		headers: { Accept: 'application/json', 'X-API-Key': conn.apiKey, ...(init.headers as Record<string, string>) },
		signal: AbortSignal.timeout(timeout)
	});
	if (res.status === 401) throw new AppError('errors.portainerAuth');
	if (res.status === 403) throw new AppError('errors.portainerForbidden');
	return res;
}

type RawSnapshot = { RunningContainerCount?: number; StoppedContainerCount?: number; HealthyContainerCount?: number; UnhealthyContainerCount?: number };
type RawEndpoint = { Id: number; Name: string; Status: number; Snapshots?: RawSnapshot[] };
type RawStack = { Id: number; Name: string; EndpointId: number; Status: number; Type: number };

export async function overview(conn: PortainerConn): Promise<PortainerData> {
	// Users without stack rights get 403 on /stacks: show the environments anyway.
	const [eRes, sRes] = await Promise.all([portainer(conn, '/endpoints'), portainer(conn, '/stacks').catch(() => null)]);
	if (!eRes.ok) throw new AppError('errors.answeredHttp', { name: 'Portainer', status: eRes.status });
	const endpoints: PortainerEndpoint[] = ((await eRes.json()) as RawEndpoint[]).map((e) => {
		const snap = e.Snapshots?.[0] ?? {};
		return {
			id: e.Id,
			name: e.Name,
			up: e.Status === 1,
			running: snap.RunningContainerCount ?? 0,
			stopped: snap.StoppedContainerCount ?? 0,
			healthy: snap.HealthyContainerCount ?? 0,
			unhealthy: snap.UnhealthyContainerCount ?? 0
		};
	});
	const stacks: PortainerStack[] = sRes?.ok
		? ((await sRes.json()) as RawStack[])
				.map((s) => ({ id: s.Id, name: s.Name, endpointId: s.EndpointId, active: s.Status === 1, type: s.Type }))
				.sort((a, b) => a.name.localeCompare(b.name))
		: [];
	return { endpoints, stacks, url: conn.publicBase };
}

export async function stackAction(conn: PortainerConn, id: number, endpointId: number, action: 'start' | 'stop'): Promise<void> {
	const res = await portainer(conn, `/stacks/${id}/${action}?endpointId=${endpointId}`, { method: 'POST' }, ACTION_TIMEOUT_MS);
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string; details?: string } | null;
		throw new Error(body?.details || body?.message || `Portainer answered HTTP ${res.status}`);
	}
}
