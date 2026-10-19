// PsiTransfer client: uploads go through CatBoard in small chunks (request
// bodies are limited, PsiTransfer sends no CORS headers, and the upload
// password stays here), forwarded with the tus protocol PsiTransfer speaks.
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import { AppError } from '$lib/server/api-error';

export type PsiConn = { base: string; publicBase: string; password: string };

export interface PsiConfig {
	retentions: Record<string, string>;
	defaultRetention: string;
	requireBucketPassword: boolean;
	maxFileSize: number | null;
	maxBucketSize: number | null;
}

const TIMEOUT_MS = 15_000;
const UPLOAD_TTL_MS = 3600_000;

export async function psiConn(): Promise<PsiConn | null> {
	const c = (await getIntegrations()).psitransfer;
	if (!c?.url) return null;
	return { base: normalizeUrl(c.url), publicBase: normalizeUrl(c.publicUrl || c.url), password: c.uploadPassword || '' };
}

function headers(conn: PsiConn, extra: Record<string, string> = {}): Record<string, string> {
	return { 'Tus-Resumable': '1.0.0', ...(conn.password ? { 'x-passwd': conn.password } : {}), ...extra };
}

let cached: { base: string; at: number; config: PsiConfig } | null = null;

/** PsiTransfer's own settings (retentions, size limits), cached 10 minutes. */
export async function psiConfig(conn: PsiConn): Promise<PsiConfig> {
	if (cached && cached.base === conn.base && Date.now() - cached.at < 600_000) return cached.config;
	const res = await fetch(`${conn.base}/config.json`, { headers: headers(conn), signal: AbortSignal.timeout(TIMEOUT_MS) });
	if (res.status === 401 || res.status === 403) throw new AppError('errors.psiNeedsPassword');
	if (!res.ok) throw new AppError('errors.answeredHttp', { name: 'PsiTransfer', status: res.status });
	const body = await res.json();
	const config: PsiConfig = {
		retentions: body.retentions ?? {},
		defaultRetention: String(body.defaultRetention ?? ''),
		requireBucketPassword: !!body.requireBucketPassword,
		maxFileSize: body.maxFileSize ?? null,
		maxBucketSize: body.maxBucketSize ?? null
	};
	cached = { base: conn.base, at: Date.now(), config };
	return config;
}

/** A bucket id like PsiTransfer's own (12 hex characters). */
export const isSid = (sid: string) => /^[0-9a-f]{12}$/.test(sid);

/** PsiTransfer refuses names with paths or control characters: keep a flat, safe name. */
export function safeName(name: string): string {
	const base = name.split(/[\\/]/).pop() ?? '';
	// eslint-disable-next-line no-control-regex
	const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/^\.+/, '').trim();
	return clean.slice(0, 200) || 'file';
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

// Uploads in progress: CatBoard id -> PsiTransfer upload path (relative to the base).
const uploads = new Map<string, { path: string; at: number; sid: string }>();
setInterval(() => {
	const now = Date.now();
	for (const [id, u] of uploads) if (now - u.at > UPLOAD_TTL_MS) uploads.delete(id);
}, 600_000).unref?.();

export async function createUpload(
	conn: PsiConn,
	meta: { sid: string; name: string; size: number; type: string; retention: string; password: string }
): Promise<string> {
	const fields: Record<string, string> = { sid: meta.sid, retention: meta.retention, name: safeName(meta.name), comment: '', type: meta.type || 'application/octet-stream' };
	if (meta.password) fields.password = meta.password;
	const res = await fetch(`${conn.base}/files`, {
		method: 'POST',
		headers: headers(conn, {
			'Upload-Length': String(meta.size),
			'Upload-Metadata': Object.entries(fields).map(([k, v]) => `${k} ${b64(v)}`).join(',')
		}),
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	if (res.status === 413) throw new Error((await res.json().catch(() => null))?.message || 'File too large for PsiTransfer');
	if (res.status === 401 || res.status === 403) throw new AppError('errors.psiPassword');
	const location = res.headers.get('location');
	if (!res.ok || !location) throw new Error(`PsiTransfer answered HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
	// The location may be absolute (with PsiTransfer's own host) or relative: keep the path after /files/.
	const path = new URL(location, conn.base + '/').pathname.replace(/^.*\/files\//, 'files/');
	const id = crypto.randomUUID();
	uploads.set(id, { path, at: Date.now(), sid: meta.sid });
	return id;
}

export async function appendChunk(conn: PsiConn, id: string, offset: number, chunk: ArrayBuffer): Promise<number> {
	const up = uploads.get(id);
	if (!up) throw new AppError('errors.unknownUpload');
	up.at = Date.now();
	const res = await fetch(`${conn.base}/${up.path}`, {
		method: 'PATCH',
		headers: headers(conn, { 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' }),
		body: chunk,
		signal: AbortSignal.timeout(TIMEOUT_MS * 2)
	});
	if (!res.ok) throw new Error(`PsiTransfer answered HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
	return Number(res.headers.get('upload-offset') ?? offset + chunk.byteLength);
}

/** Close a bucket once its files are sent (like PsiTransfer's own page does). */
export async function lockBucket(conn: PsiConn, sid: string): Promise<void> {
	await fetch(`${conn.base}/files/${sid}?lock=yes`, { method: 'PATCH', headers: headers(conn), signal: AbortSignal.timeout(TIMEOUT_MS) });
	for (const [id, u] of uploads) if (u.sid === sid) uploads.delete(id);
}
