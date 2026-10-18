// Nextcloud client: basic auth with an app password. Quota from the OCS user
// API, server info from the serverinfo app (admins), recent files from a
// WebDAV SEARCH ordered by modification date.
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import type { NextcloudData, NextcloudFile } from '$lib/types';

const TIMEOUT_MS = 10_000;

export type NextcloudConn = { base: string; publicBase: string; user: string; auth: string };

export function nextcloudConnOf(c: { url: string; publicUrl?: string; username?: string; appPassword?: string }): NextcloudConn {
	return {
		base: normalizeUrl(c.url),
		publicBase: normalizeUrl(c.publicUrl || c.url),
		user: c.username ?? '',
		auth: 'Basic ' + Buffer.from(`${c.username ?? ''}:${c.appPassword ?? ''}`).toString('base64')
	};
}

export async function nextcloudConn(): Promise<NextcloudConn | null> {
	const c = (await getIntegrations()).nextcloud;
	return c?.url ? nextcloudConnOf(c) : null;
}

function nc(conn: NextcloudConn, path: string, init: RequestInit = {}): Promise<Response> {
	return fetch(`${conn.base}${path}`, {
		...init,
		headers: { Authorization: conn.auth, 'OCS-APIRequest': 'true', Accept: 'application/json', ...(init.headers as Record<string, string>) },
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
}

type OcsUser = { displayname?: string; quota?: { used?: number; total?: number; quota?: number } };

export async function ocsUser(conn: NextcloudConn): Promise<OcsUser> {
	const res = await nc(conn, `/ocs/v2.php/cloud/users/${encodeURIComponent(conn.user)}?format=json`);
	if (res.status === 401) throw new Error('Nextcloud refused the username or app password');
	if (!res.ok) throw new Error(`Nextcloud answered HTTP ${res.status}`);
	return ((await res.json()) as { ocs: { data: OcsUser } }).ocs.data;
}

type ServerInfo = {
	nextcloud?: { system?: { version?: string; cpuload?: number[]; freespace?: number }; storage?: { num_files?: number } };
	activeUsers?: { last24hours?: number };
};

async function serverInfo(conn: NextcloudConn): Promise<NextcloudData['server']> {
	const res = await nc(conn, '/ocs/v2.php/apps/serverinfo/api/v1/info?format=json&skipApps=true&skipUpdate=true');
	if (!res.ok) return null;
	const d = ((await res.json()) as { ocs: { data: ServerInfo } }).ocs?.data;
	const sys = d?.nextcloud?.system;
	return {
		version: sys?.version ?? '',
		freeSpace: sys?.freespace ?? null,
		files: d?.nextcloud?.storage?.num_files ?? null,
		activeUsers: d?.activeUsers?.last24hours ?? null,
		cpuLoad: sys?.cpuload?.[0] ?? null
	};
}

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const tag = (block: string, name: string) => block.match(new RegExp(`<[a-z]+:${name}[^>]*>([^<]*)</[a-z]+:${name}>`, 'i'))?.[1];

async function recentFiles(conn: NextcloudConn, limit: number): Promise<NextcloudFile[]> {
	const body = `<?xml version="1.0"?>
<d:searchrequest xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
 <d:basicsearch>
  <d:select><d:prop><d:displayname/><d:getlastmodified/><d:getcontentlength/><oc:fileid/></d:prop></d:select>
  <d:from><d:scope><d:href>/files/${xmlEscape(conn.user)}</d:href><d:depth>infinity</d:depth></d:scope></d:from>
  <d:where><d:not><d:eq><d:prop><d:getcontenttype/></d:prop><d:literal>httpd/unix-directory</d:literal></d:eq></d:not></d:where>
  <d:orderby><d:order><d:prop><d:getlastmodified/></d:prop><d:descending/></d:order></d:orderby>
  <d:limit><d:nresults>${limit}</d:nresults></d:limit>
 </d:basicsearch>
</d:searchrequest>`;
	const res = await nc(conn, '/remote.php/dav/', { method: 'SEARCH', headers: { 'Content-Type': 'text/xml', Accept: 'application/xml' }, body });
	if (!res.ok) throw new Error(`Nextcloud search answered HTTP ${res.status}`);
	return parseSearch(await res.text(), conn, limit);
}

/** Files of a WebDAV SEARCH answer: names decoded, paths relative to the user's root. */
export function parseSearch(xml: string, conn: Pick<NextcloudConn, 'user' | 'publicBase'>, limit: number): NextcloudFile[] {
	const prefix = `/remote.php/dav/files/${encodeURIComponent(conn.user)}`;
	return [...xml.matchAll(/<d:response>([\s\S]*?)<\/d:response>/gi)]
		.map(([, block]) => {
			const href = decodeURIComponent(decode(tag(block, 'href') ?? ''));
			const path = href.startsWith(decodeURIComponent(prefix)) ? href.slice(decodeURIComponent(prefix).length) : href;
			const fileId = tag(block, 'fileid');
			return {
				name: decode(tag(block, 'displayname') ?? path.split('/').pop() ?? ''),
				path,
				modified: Date.parse(tag(block, 'getlastmodified') ?? '') || 0,
				size: Number(tag(block, 'getcontentlength') ?? 0),
				url: fileId ? `${conn.publicBase}/f/${fileId}` : `${conn.publicBase}/apps/files/`
			};
		})
		.filter((f) => f.name)
		.slice(0, limit);
}

export async function overview(conn: NextcloudConn, opts: { server: boolean; files: number }): Promise<NextcloudData> {
	const [user, server, files] = await Promise.all([
		ocsUser(conn),
		opts.server ? serverInfo(conn).catch(() => null) : Promise.resolve(null),
		opts.files > 0 ? recentFiles(conn, opts.files) : Promise.resolve([])
	]);
	const total = user.quota?.total;
	return {
		// A negative quota means unlimited.
		user: { name: user.displayname || conn.user, used: user.quota?.used ?? 0, total: total && total > 0 && (user.quota?.quota ?? 0) >= 0 ? total : null },
		server,
		files,
		url: conn.publicBase
	};
}
