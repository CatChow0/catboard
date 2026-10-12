// qBittorrent Web API client. Logs in once and keeps the session cookie in
// memory per server; a 403 means the session expired, so it logs in again.
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import type { Torrent, TorrentState } from '$lib/types';

type Conn = { base: string; username: string; password: string };

const sessions = new Map<string, string>(); // base URL -> "NAME=value" cookie

export async function qbitConn(): Promise<Conn | null> {
	const c = (await getIntegrations()).qbittorrent;
	return c?.url ? { base: normalizeUrl(c.url), username: c.username || '', password: c.password || '' } : null;
}

async function login(conn: Conn): Promise<string> {
	const res = await fetch(`${conn.base}/api/v2/auth/login`, {
		method: 'POST',
		// qBittorrent's CSRF protection wants a Referer/Origin matching its own URL.
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: conn.base, Origin: conn.base },
		body: new URLSearchParams({ username: conn.username, password: conn.password }),
		signal: AbortSignal.timeout(8000)
	});
	const text = await res.text();
	if (!res.ok || text.trim() === 'Fails.') throw new Error(res.status === 403 ? 'qBittorrent banned this IP after failed logins' : 'Wrong qBittorrent username or password');
	// Cookie name is SID on 4.x and configurable on 5.x; keep whatever it sent.
	const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
	sessions.set(conn.base, cookie);
	return cookie;
}

export async function qbit(conn: Conn, path: string, form?: Record<string, string>): Promise<Response> {
	const send = (cookie: string) =>
		fetch(`${conn.base}/api/v2${path}`, {
			method: form ? 'POST' : 'GET',
			headers: {
				Referer: conn.base,
				...(cookie ? { Cookie: cookie } : {}),
				...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
			},
			body: form ? new URLSearchParams(form) : undefined,
			signal: AbortSignal.timeout(8000)
		});
	let res = await send(sessions.get(conn.base) ?? (await login(conn)));
	if (res.status === 403) res = await send(await login(conn));
	return res;
}

const STATE: Record<string, TorrentState> = {
	downloading: 'downloading', metaDL: 'downloading', forcedDL: 'downloading', allocating: 'downloading', forcedMetaDL: 'downloading',
	stalledDL: 'stalled',
	uploading: 'seeding', forcedUP: 'seeding', stalledUP: 'seeding',
	pausedDL: 'paused', stoppedDL: 'paused',
	pausedUP: 'completed', stoppedUP: 'completed',
	queuedDL: 'queued', queuedUP: 'queued',
	checkingDL: 'checking', checkingUP: 'checking', checkingResumeData: 'checking', moving: 'checking',
	error: 'error', missingFiles: 'error'
};

export function toTorrent(t: Record<string, any>): Torrent {
	return {
		hash: t.hash,
		name: t.name,
		progress: t.progress ?? 0,
		state: STATE[t.state] ?? 'queued',
		dlSpeed: t.dlspeed ?? 0,
		upSpeed: t.upspeed ?? 0,
		eta: t.eta != null && t.eta < 8640000 ? t.eta : -1, // 8640000 = qBittorrent's "infinity"
		size: t.size ?? t.total_size ?? 0,
		ratio: t.ratio ?? 0
	};
}

/** Pause/resume, compatible with qBittorrent 5 (stop/start) and 4 (pause/resume). */
export async function setPaused(conn: Conn, hashes: string, paused: boolean): Promise<void> {
	let res = await qbit(conn, paused ? '/torrents/stop' : '/torrents/start', { hashes });
	if (res.status === 404) res = await qbit(conn, paused ? '/torrents/pause' : '/torrents/resume', { hashes });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
