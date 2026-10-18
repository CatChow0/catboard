import { json, type RequestHandler } from '@sveltejs/kit';
import mqtt from 'mqtt';
import { requireAdmin } from '$lib/server/auth';
import { normalizeUrl } from '$lib/server/arr';
import { basicAuth } from '$lib/server/adguard-home';
import { dockerGet } from '$lib/server/docker';
import { discover } from '$lib/server/elegoo-cc2';
import type { IntegrationKey } from '$lib/integrations/registry';
import { httpFetch, isOn } from '$lib/server/http';
import { pveConnOf, pve } from '$lib/server/proxmox';
import { nextcloudConnOf, ocsUser } from '$lib/server/nextcloud';

type Result = { ok: boolean; message: string };
type Values = Record<string, string | undefined>;

const TIMEOUT_MS = 5000;

/** Readable reason for a failed fetch (Node only says "fetch failed"). */
function reason(err: unknown, url: string): string {
	if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) return `No answer from ${url} within 5 s`;
	type NetError = { code?: string; errors?: NetError[] };
	const cause = (err as { cause?: NetError })?.cause;
	const code = cause?.code ?? cause?.errors?.[0]?.code;
	if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return `Unknown host in ${url}`;
	if (code === 'ECONNREFUSED') return `Connection refused by ${url} (wrong port, or the service is down)`;
	if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'ETIMEDOUT') return `${url} is unreachable from the CatBoard server`;
	if (code?.startsWith('ERR_TLS') || code?.includes('CERT')) return `TLS error with ${url} (${code})`;
	return err instanceof Error ? err.message : String(err);
}

async function get(url: string, headers: Record<string, string> = {}, init: RequestInit = {}): Promise<Response> {
	return fetch(url, { ...init, headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

function httpError(res: Response, what: string): Result {
	const hint = res.status === 401 || res.status === 403 ? ' (check the credentials)' : res.status === 404 ? ' (is this the right URL?)' : '';
	return { ok: false, message: `${what} answered HTTP ${res.status}${hint}` };
}

async function testArr(v: Values, name: string, apiVersion: 'v1' | 'v3'): Promise<Result> {
	const res = await get(`${normalizeUrl(v.url!)}/api/${apiVersion}/system/status`, { 'X-Api-Key': v.apiKey ?? '' });
	if (!res.ok) return httpError(res, name);
	const body = await res.json().catch(() => null);
	if (!body?.version) return { ok: false, message: `This does not look like ${name} (no version in the answer)` };
	return { ok: true, message: `${body.appName || name} ${body.version}` };
}

async function testElegoo(v: Values): Promise<Result> {
	const host = (v.host ?? '').trim();
	if (!/^[a-z0-9.:-]{1,253}$/i.test(host)) return { ok: false, message: 'Enter the printer IP address' };
	const found = await discover(host);
	// Connect once with the access code, then leave (the printer accepts ~4 clients).
	const accepted = await new Promise<string | null>((resolve) => {
		const client = mqtt.connect(`mqtt://${host}:1883`, {
			username: 'elegoo',
			password: v.accessCode?.trim() || '123456',
			clientId: 'cbtest' + Date.now().toString(16).slice(-4),
			protocolVersion: 4,
			reconnectPeriod: 0,
			connectTimeout: TIMEOUT_MS
		});
		const done = (err: string | null) => {
			client.end(true);
			resolve(err);
		};
		client.on('connect', () => done(null));
		client.on('error', (e: Error & { code?: string | number }) =>
			done(e.code === 4 || e.code === 5 ? 'The printer refused the access code' : e.message || 'MQTT error')
		);
		client.on('close', () => done('The printer closed the connection (too many clients connected?)'));
	});
	if (accepted) return { ok: false, message: accepted };
	return { ok: true, message: `${found.model || 'Printer'} ${found.sn}${v.serial && v.serial !== found.sn ? ` (the serial number field says ${v.serial})` : ''}` };
}

async function run(key: IntegrationKey, v: Values): Promise<Result> {
	const url = v.url?.trim() ?? '';
	switch (key) {
		case 'uptimeKuma': {
			const res = await get(`${normalizeUrl(url)}/api/entry-page`);
			if (!res.ok) return httpError(res, 'Uptime Kuma');
			const body = await res.json().catch(() => null);
			return body?.type ? { ok: true, message: 'Uptime Kuma is reachable' } : { ok: false, message: 'This does not look like Uptime Kuma' };
		}
		case 'docker': {
			if (!url) return { ok: false, message: 'Enter a socket path or URL' };
			const res = await dockerGet({ id: 'test', name: '', url }, '/version');
			if (!res.ok) return { ok: false, message: res.status ? `Docker answered HTTP ${res.status}` : `Cannot reach Docker at ${url}: ${(await res.text()) || 'no answer'}` };
			const body = await res.json().catch(() => null);
			return { ok: true, message: `Docker ${body?.Version ?? ''}`.trim() };
		}
		case 'stacker': {
			const headers: Record<string, string> = v.username ? { Authorization: 'Basic ' + btoa(`${v.username}:${v.password ?? ''}`) } : {};
			const res = await get(`${normalizeUrl(url)}/api/snapshot?static=1&limit=1`, headers);
			if (!res.ok) return httpError(res, 'Stacker');
			if (!res.headers.get('content-type')?.includes('application/json')) return { ok: false, message: 'This Stacker has no /api/snapshot endpoint yet: update Stacker' };
			return { ok: true, message: 'Stacker is reachable' };
		}
		case 'radarr':
			return testArr(v, 'Radarr', 'v3');
		case 'sonarr':
			return testArr(v, 'Sonarr', 'v3');
		case 'lidarr':
			return testArr(v, 'Lidarr', 'v1');
		case 'jellyfin': {
			const res = await get(`${normalizeUrl(url)}/System/Info`, { 'X-Emby-Token': v.apiKey ?? '' });
			if (!res.ok) return httpError(res, 'Jellyfin');
			const body = await res.json().catch(() => null);
			return { ok: true, message: `${body?.ServerName || 'Jellyfin'} ${body?.Version ?? ''}`.trim() };
		}
		case 'jellyseerr': {
			const base = normalizeUrl(url);
			const me = await get(`${base}/api/v1/auth/me`, { 'X-Api-Key': v.apiKey ?? '' });
			if (!me.ok) return httpError(me, 'Jellyseerr');
			const status = await get(`${base}/api/v1/status`).then((r) => r.json()).catch(() => null);
			return { ok: true, message: `Jellyseerr / Overseerr ${status?.version ?? ''}`.trim() };
		}
		case 'qbittorrent': {
			const base = normalizeUrl(url);
			const login = await fetch(`${base}/api/v2/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: base, Origin: base },
				body: new URLSearchParams({ username: v.username ?? '', password: v.password ?? '' }),
				signal: AbortSignal.timeout(TIMEOUT_MS)
			});
			const text = await login.text();
			if (login.status === 403) return { ok: false, message: 'qBittorrent banned this IP after failed logins' };
			if (!login.ok || text.trim() === 'Fails.') return { ok: false, message: 'Wrong qBittorrent username or password' };
			const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
			const version = await get(`${base}/api/v2/app/version`, { Referer: base, Cookie: cookie }).then((r) => (r.ok ? r.text() : '')).catch(() => '');
			return { ok: true, message: `qBittorrent ${version}`.trim() };
		}
		case 'spoolman': {
			const res = await get(`${normalizeUrl(url)}/api/v1/info`);
			if (!res.ok) return httpError(res, 'Spoolman');
			const body = await res.json().catch(() => null);
			return body?.version ? { ok: true, message: `Spoolman ${body.version}` } : { ok: false, message: 'This does not look like Spoolman' };
		}
		case 'adguardHome': {
			const res = await get(`${normalizeUrl(url)}/control/status`, { Authorization: basicAuth(v.username ?? '', v.password ?? '') });
			if (!res.ok) return httpError(res, 'AdGuard Home');
			const body = await res.json().catch(() => null);
			return { ok: true, message: `AdGuard Home ${body?.version ?? ''}`.trim() };
		}
		case 'psitransfer': {
			const res = await get(`${normalizeUrl(url)}/config.json`, v.uploadPassword ? { 'x-passwd': v.uploadPassword } : {});
			if (res.status === 401) return { ok: false, message: 'PsiTransfer asks for an upload password: fill it in (advanced)' };
			if (res.status === 403) return { ok: false, message: 'PsiTransfer refused the upload password' };
			if (!res.ok) return httpError(res, 'PsiTransfer');
			const body = await res.json().catch(() => null);
			const n = Object.keys(body?.retentions ?? {}).length;
			return n ? { ok: true, message: `PsiTransfer is reachable (${n} retention choices)` } : { ok: false, message: 'This does not look like PsiTransfer' };
		}
		case 'jenkins': {
			const auth: Record<string, string> = v.username ? { Authorization: 'Basic ' + Buffer.from(`${v.username}:${v.apiToken ?? ''}`).toString('base64') } : {};
			const res = await get(`${normalizeUrl(url)}/api/json?tree=mode`, auth);
			if (res.status === 401) return { ok: false, message: 'Jenkins refused the username or API token' };
			if (res.status === 403) return { ok: false, message: 'This Jenkins user may not read jobs (Overall/Read)' };
			if (!res.ok) return httpError(res, 'Jenkins');
			const version = res.headers.get('x-jenkins');
			return version ? { ok: true, message: `Jenkins ${version}` } : { ok: false, message: 'This does not look like Jenkins' };
		}
		case 'proxmox': {
			if (!/^[^@\s]+@[^!\s]+![^\s]+$/.test(v.tokenId ?? '')) return { ok: false, message: 'The token ID looks like user@realm!name' };
			const version = await pve<{ version: string; release: string }>(pveConnOf({ url, tokenId: v.tokenId!, tokenSecret: v.tokenSecret ?? '', insecure: v.insecure }), '/version');
			return { ok: true, message: `Proxmox VE ${version.version}` };
		}
		case 'portainer': {
			const res = await httpFetch(`${normalizeUrl(url)}/api/endpoints?limit=1`, { insecure: isOn(v.insecure), headers: { Accept: 'application/json', 'X-API-Key': v.apiKey ?? '' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
			if (res.status === 401) return { ok: false, message: 'Portainer refused the access token' };
			if (!res.ok) return httpError(res, 'Portainer');
			const status = await httpFetch(`${normalizeUrl(url)}/api/system/status`, { insecure: isOn(v.insecure), headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
				.then((r) => r.json())
				.catch(() => null);
			return { ok: true, message: `Portainer ${status?.Version ?? ''}`.trim() };
		}
		case 'immich': {
			const me = await get(`${normalizeUrl(url)}/api/users/me`, { 'x-api-key': v.apiKey ?? '' });
			if (me.status === 401) return { ok: false, message: 'Immich refused the API key' };
			if (!me.ok) return httpError(me, 'Immich');
			const user = await me.json().catch(() => null);
			const ver = await get(`${normalizeUrl(url)}/api/server/version`).then((r) => r.json()).catch(() => null);
			const version = ver?.major != null ? ` ${ver.major}.${ver.minor}.${ver.patch}` : '';
			return { ok: true, message: `Immich${version}, key of ${user?.name || user?.email || 'a user'}${user?.isAdmin ? ' (admin)' : ''}` };
		}
		case 'nextcloud': {
			if (!v.username) return { ok: false, message: 'Enter the username' };
			const user = await ocsUser(nextcloudConnOf({ url, username: v.username, appPassword: v.appPassword }));
			return { ok: true, message: `Nextcloud, signed in as ${user.displayname || v.username}` };
		}
		case 'elegoo':
			return testElegoo(v);
		default:
			return { ok: false, message: 'This connection cannot be tested' };
	}
}

/**
 * POST {key, value} — tries a connection with the values typed in Settings >
 * Integrations, before they are saved. `value` is the connection object of a
 * single integration, or one item (environment, server, printer) of a list.
 * Admins only: it makes the server contact an address chosen by the caller.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const body = await request.json().catch(() => ({}));
	const key = String(body?.key ?? '') as IntegrationKey;
	const value: Values = body?.value && typeof body.value === 'object' ? body.value : {};
	const url = String(value.url ?? '').trim();
	if (key !== 'elegoo' && key !== 'docker' && !/^https?:\/\/[^\s]+$/i.test(url)) {
		return json({ ok: false, message: 'Enter a full URL, starting with http:// or https://' } satisfies Result);
	}
	try {
		return json(await run(key, value));
	} catch (err) {
		return json({ ok: false, message: reason(err, url || String(value.host ?? '')) } satisfies Result);
	}
};
