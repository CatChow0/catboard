// Proxmox VE client: API token auth (no ticket, no CSRF token), everything the
// widget shows comes from one /cluster/resources call.
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import { httpFetch, isOn } from '$lib/server/http';
import type { ProxmoxCluster, ProxmoxData, ProxmoxGuest, ProxmoxNode } from '$lib/types';
import { AppError } from '$lib/server/api-error';

const TIMEOUT_MS = 10_000;

export type PveConn = { base: string; auth: string; insecure: boolean };

export function pveConnOf(c: Pick<ProxmoxCluster, 'url' | 'tokenId' | 'tokenSecret' | 'insecure'>): PveConn {
	return { base: normalizeUrl(c.url), auth: `PVEAPIToken=${c.tokenId ?? ''}=${c.tokenSecret ?? ''}`, insecure: isOn(c.insecure) };
}

export async function pveConn(clusterId: string): Promise<PveConn | null> {
	const clusters = (await getIntegrations()).proxmox?.clusters ?? [];
	const c = clusters.find((x) => x.id === clusterId) ?? (clusterId ? undefined : clusters[0]);
	return c?.url ? pveConnOf(c) : null;
}

export async function pve<T>(conn: PveConn, path: string, init: RequestInit = {}): Promise<T> {
	const res = await httpFetch(`${conn.base}/api2/json${path}`, {
		...init,
		insecure: conn.insecure,
		headers: { Accept: 'application/json', Authorization: conn.auth, ...(init.headers as Record<string, string>) },
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	if (res.status === 401) throw new AppError('errors.proxmoxAuth');
	if (res.status === 403) throw new AppError('errors.proxmoxPerm');
	if (!res.ok) throw new AppError('errors.answeredHttp', { name: 'Proxmox', status: res.status });
	return ((await res.json()) as { data: T }).data;
}

type RawResource = { type: string; node?: string; status?: string; name?: string; vmid?: number; cpu?: number; maxcpu?: number; mem?: number; maxmem?: number; uptime?: number; template?: number };

export async function resources(conn: PveConn): Promise<ProxmoxData> {
	const list = await pve<RawResource[]>(conn, '/cluster/resources');
	const nodes: ProxmoxNode[] = list
		.filter((r) => r.type === 'node')
		.map((r) => ({ node: r.node ?? '', status: r.status ?? 'unknown', cpu: r.cpu ?? 0, maxcpu: r.maxcpu ?? 0, mem: r.mem ?? 0, maxmem: r.maxmem ?? 0, uptime: r.uptime ?? 0 }))
		.sort((a, b) => a.node.localeCompare(b.node));
	const guests: ProxmoxGuest[] = list
		.filter((r) => (r.type === 'qemu' || r.type === 'lxc') && !r.template)
		.map((r) => ({
			vmid: r.vmid ?? 0,
			name: r.name ?? `${r.type === 'lxc' ? 'CT' : 'VM'} ${r.vmid}`,
			type: r.type as 'qemu' | 'lxc',
			node: r.node ?? '',
			status: r.status ?? 'unknown',
			cpu: r.cpu ?? 0,
			maxcpu: r.maxcpu ?? 0,
			mem: r.mem ?? 0,
			maxmem: r.maxmem ?? 0,
			uptime: r.uptime ?? 0
		}))
		.sort((a, b) => a.vmid - b.vmid);
	return { nodes, guests, url: conn.base };
}

export const GUEST_ACTIONS = ['start', 'shutdown', 'reboot', 'stop'] as const;
export type GuestAction = (typeof GUEST_ACTIONS)[number];

/** Start / shut down / reboot / stop a guest; returns the task id. */
export async function guestAction(conn: PveConn, node: string, type: 'qemu' | 'lxc', vmid: number, action: GuestAction): Promise<string> {
	return pve<string>(conn, `/nodes/${encodeURIComponent(node)}/${type}/${vmid}/status/${action}`, { method: 'POST' });
}
