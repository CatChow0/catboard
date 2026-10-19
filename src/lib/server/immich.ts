// Immich client (x-api-key). Server statistics need an admin key; other keys
// fall back to the key owner's own statistics. Thumbnails are proxied so the
// browser never needs the API key.
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import type { ImmichData } from '$lib/types';
import { AppError } from '$lib/server/api-error';

const TIMEOUT_MS = 10_000;

export type ImmichConn = { base: string; publicBase: string; apiKey: string };

export async function immichConn(): Promise<ImmichConn | null> {
	const c = (await getIntegrations()).immich;
	if (!c?.url) return null;
	return { base: normalizeUrl(c.url), publicBase: normalizeUrl(c.publicUrl || c.url), apiKey: c.apiKey ?? '' };
}

export function immich(conn: ImmichConn, path: string, init: RequestInit = {}): Promise<Response> {
	return fetch(`${conn.base}/api${path}`, {
		...init,
		headers: { Accept: 'application/json', 'x-api-key': conn.apiKey, ...(init.headers as Record<string, string>) },
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
}

async function immichJson<T>(conn: ImmichConn, path: string, init?: RequestInit): Promise<T> {
	const res = await immich(conn, path, init);
	if (res.status === 401) throw new AppError('errors.immichKey');
	if (!res.ok) throw new AppError('errors.answeredHttp', { name: 'Immich', status: res.status });
	return res.json() as Promise<T>;
}

export const isAssetId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function summary(conn: ImmichConn, photos: number): Promise<ImmichData> {
	let stats: ImmichData['stats'];
	const server = await immich(conn, '/server/statistics');
	if (server.ok) {
		const s = (await server.json()) as { photos: number; videos: number; usage: number };
		stats = { photos: s.photos, videos: s.videos, usage: s.usage, scope: 'server' };
	} else {
		const s = await immichJson<{ images: number; videos: number }>(conn, '/assets/statistics');
		stats = { photos: s.images, videos: s.videos, usage: null, scope: 'user' };
	}
	let recent: ImmichData['recent'] = [];
	if (photos > 0) {
		const found = await immichJson<{ assets: { items: { id: string; fileCreatedAt: string }[] } }>(conn, '/search/metadata', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'IMAGE', order: 'desc', size: photos, withDeleted: false })
		});
		recent = found.assets.items.map((a) => ({ id: a.id, date: a.fileCreatedAt }));
	}
	return { stats, recent, url: conn.publicBase };
}
