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
import { AppError, msg } from '$lib/server/api-error';
import type { Key, Params } from '$lib/i18n';
import { translate } from '$lib/i18n';

type Result = { ok: boolean; message: string; code?: Key; params?: Params };
type Values = Record<string, string | undefined>;

const TIMEOUT_MS = 5000;

/** Readable reason for a failed fetch (Node only says "fetch failed"). */
function reason(err: unknown, url: string): Omit<Result, 'ok'> {
	if (err instanceof AppError) return msg(err.code, err.params);
	if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) return msg('errors.noAnswerWithin', { url });
	type NetError = { code?: string; errors?: NetError[] };
	const cause = (err as { cause?: NetError })?.cause;
	const code = cause?.code ?? cause?.errors?.[0]?.code;
	if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return msg('errors.unknownHost', { url });
	if (code === 'ECONNREFUSED') return msg('errors.connRefused', { url });
	if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'ETIMEDOUT') return msg('errors.unreachable', { url });
	if (code?.startsWith('ERR_TLS') || code?.includes('CERT')) return msg('errors.tls', { url, code });
	return { message: err instanceof Error ? err.message : String(err) };
}

async function get(url: string, headers: Record<string, string> = {}, init: RequestInit = {}): Promise<Response> {
	return fetch(url, { ...init, headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

function httpError(res: Response, what: string): Result {
	const key: Key = res.status === 401 || res.status === 403 ? 'errors.answeredHttpCreds' : res.status === 404 ? 'errors.answeredHttpUrl' : 'errors.answeredHttp';
	return { ok: false, ...msg(key, { name: what, status: res.status }) };
}

async function testArr(v: Values, name: string, apiVersion: 'v1' | 'v3'): Promise<Result> {
	const res = await get(`${normalizeUrl(v.url!)}/api/${apiVersion}/system/status`, { 'X-Api-Key': v.apiKey ?? '' });
	if (!res.ok) return httpError(res, name);
	const body = await res.json().catch(() => null);
	if (!body?.version) return { ok: false, ...msg('errors.noVersion', { name }) };
	return { ok: true, message: `${body.appName || name} ${body.version}` };
}

async function testElegoo(v: Values): Promise<Result> {
	const host = (v.host ?? '').trim();
	if (!/^[a-z0-9.:-]{1,253}$/i.test(host)) return { ok: false, ...msg('errors.enterPrinterIp') };
	const found = await discover(host);
	// Connect once with the access code, then leave (the printer accepts ~4 clients).
	const accepted = await new Promise<Key | string | null>((resolve) => {
		const client = mqtt.connect(`mqtt://${host}:1883`, {
			username: 'elegoo',
			password: v.accessCode?.trim() || '123456',
			clientId: 'cbtest' + Date.now().toString(16).slice(-4),
			protocolVersion: 4,
			reconnectPeriod: 0,
			connectTimeout: TIMEOUT_MS
		});
		const done = (err: Key | string | null) => {
			client.end(true);
			resolve(err);
		};
		client.on('connect', () => done(null));
		client.on('error', (e: Error & { code?: string | number }) =>
			done(e.code === 4 || e.code === 5 ? 'errors.printerCode' : e.message || 'MQTT error')
		);
		client.on('close', () => done('errors.printerClosed'));
	});
	if (accepted) return { ok: false, ...(accepted.startsWith('errors.') ? msg(accepted as Key) : { message: accepted }) };
	const model = found.model || 'Printer';
	return { ok: true, ...(v.serial && v.serial !== found.sn ? msg('test.printerSerial', { model, serial: found.sn, typed: v.serial }) : msg('test.printerOk', { model, serial: found.sn })) };
}

async function run(key: IntegrationKey, v: Values): Promise<Result> {
	const url = v.url?.trim() ?? '';
	switch (key) {
		case 'uptimeKuma': {
			const res = await get(`${normalizeUrl(url)}/api/entry-page`);
			if (!res.ok) return httpError(res, 'Uptime Kuma');
			const body = await res.json().catch(() => null);
			return body?.type ? { ok: true, ...msg('test.kumaOk') } : { ok: false, ...msg('errors.notLike', { name: 'Uptime Kuma' }) };
		}
		case 'docker': {
			if (!url) return { ok: false, ...msg('errors.socketOrUrl') };
			const res = await dockerGet({ id: 'test', name: '', url }, '/version');
			if (!res.ok) return { ok: false, message: res.status ? `Docker answered HTTP ${res.status}` : `Cannot reach Docker at ${url}: ${(await res.text()) || 'no answer'}` };
			const body = await res.json().catch(() => null);
			return { ok: true, message: `Docker ${body?.Version ?? ''}`.trim() };
		}
		case 'stacker': {
			const headers: Record<string, string> = v.username ? { Authorization: 'Basic ' + btoa(`${v.username}:${v.password ?? ''}`) } : {};
			const res = await get(`${normalizeUrl(url)}/api/snapshot?static=1&limit=1`, headers);
			if (!res.ok) return httpError(res, 'Stacker');
			if (!res.headers.get('content-type')?.includes('application/json')) return { ok: false, ...msg('errors.stackerOldShort') };
			return { ok: true, ...msg('test.stackerOk') };
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
			if (login.status === 403) return { ok: false, ...msg('errors.qbitBanned') };
			if (!login.ok || text.trim() === 'Fails.') return { ok: false, ...msg('errors.qbitAuth') };
			const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
			const version = await get(`${base}/api/v2/app/version`, { Referer: base, Cookie: cookie }).then((r) => (r.ok ? r.text() : '')).catch(() => '');
			return { ok: true, message: `qBittorrent ${version}`.trim() };
		}
		case 'spoolman': {
			const res = await get(`${normalizeUrl(url)}/api/v1/info`);
			if (!res.ok) return httpError(res, 'Spoolman');
			const body = await res.json().catch(() => null);
			return body?.version ? { ok: true, message: `Spoolman ${body.version}` } : { ok: false, ...msg('errors.notLike', { name: 'Spoolman' }) };
		}
		case 'adguardHome': {
			const res = await get(`${normalizeUrl(url)}/control/status`, { Authorization: basicAuth(v.username ?? '', v.password ?? '') });
			if (!res.ok) return httpError(res, 'AdGuard Home');
			const body = await res.json().catch(() => null);
			return { ok: true, message: `AdGuard Home ${body?.version ?? ''}`.trim() };
		}
		case 'psitransfer': {
			const res = await get(`${normalizeUrl(url)}/config.json`, v.uploadPassword ? { 'x-passwd': v.uploadPassword } : {});
			if (res.status === 401) return { ok: false, ...msg('errors.psiAskPassword') };
			if (res.status === 403) return { ok: false, ...msg('errors.psiPassword') };
			if (!res.ok) return httpError(res, 'PsiTransfer');
			const body = await res.json().catch(() => null);
			const n = Object.keys(body?.retentions ?? {}).length;
			return n ? { ok: true, ...msg('test.psiOk', { count: n }) } : { ok: false, ...msg('errors.notLike', { name: 'PsiTransfer' }) };
		}
		case 'jenkins': {
			const auth: Record<string, string> = v.username ? { Authorization: 'Basic ' + Buffer.from(`${v.username}:${v.apiToken ?? ''}`).toString('base64') } : {};
			const res = await get(`${normalizeUrl(url)}/api/json?tree=mode`, auth);
			if (res.status === 401) return { ok: false, ...msg('errors.jenkinsAuth') };
			if (res.status === 403) return { ok: false, ...msg('errors.jenkinsReadShort') };
			if (!res.ok) return httpError(res, 'Jenkins');
			const version = res.headers.get('x-jenkins');
			return version ? { ok: true, message: `Jenkins ${version}` } : { ok: false, ...msg('errors.notLike', { name: 'Jenkins' }) };
		}
		case 'proxmox': {
			if (!/^[^@\s]+@[^!\s]+![^\s]+$/.test(v.tokenId ?? '')) return { ok: false, ...msg('errors.tokenIdFormat') };
			const version = await pve<{ version: string; release: string }>(pveConnOf({ url, tokenId: v.tokenId!, tokenSecret: v.tokenSecret ?? '', insecure: v.insecure }), '/version');
			return { ok: true, message: `Proxmox VE ${version.version}` };
		}
		case 'portainer': {
			const res = await httpFetch(`${normalizeUrl(url)}/api/endpoints?limit=1`, { insecure: isOn(v.insecure), headers: { Accept: 'application/json', 'X-API-Key': v.apiKey ?? '' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
			if (res.status === 401) return { ok: false, ...msg('errors.portainerAuth') };
			if (!res.ok) return httpError(res, 'Portainer');
			const status = await httpFetch(`${normalizeUrl(url)}/api/system/status`, { insecure: isOn(v.insecure), headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
				.then((r) => r.json())
				.catch(() => null);
			return { ok: true, message: `Portainer ${status?.Version ?? ''}`.trim() };
		}
		case 'immich': {
			const me = await get(`${normalizeUrl(url)}/api/users/me`, { 'x-api-key': v.apiKey ?? '' });
			if (me.status === 401) return { ok: false, ...msg('errors.immichKey') };
			if (!me.ok) return httpError(me, 'Immich');
			const user = await me.json().catch(() => null);
			const ver = await get(`${normalizeUrl(url)}/api/server/version`).then((r) => r.json()).catch(() => null);
			const version = ver?.major != null ? ` ${ver.major}.${ver.minor}.${ver.patch}` : '';
			return { ok: true, ...msg(user?.isAdmin ? 'test.immichAdmin' : 'test.immichOk', { version, user: user?.name || user?.email || translate('en', 'test.aUser') }) };
		}
		case 'nextcloud': {
			if (!v.username) return { ok: false, ...msg('errors.enterUsername') };
			const user = await ocsUser(nextcloudConnOf({ url, username: v.username, appPassword: v.appPassword }));
			return { ok: true, ...msg('test.nextcloudOk', { user: user.displayname || v.username }) };
		}
		case 'elegoo':
			return testElegoo(v);
		default:
			return { ok: false, ...msg('errors.cannotTest') };
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
		return json({ ok: false, ...msg('errors.fullUrl') } satisfies Result);
	}
	try {
		return json(await run(key, value));
	} catch (err) {
		return json({ ok: false, ...reason(err, url || String(value.host ?? '')) } satisfies Result);
	}
};
