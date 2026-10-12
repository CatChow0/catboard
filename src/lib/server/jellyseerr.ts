// Jellyseerr / Overseerr client (both expose the same /api/v1 with an X-Api-Key).
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import type { JellyseerrRequest, JellyseerrStatus } from '$lib/types';

type Raw = Record<string, any>;

export async function jellyseerrConn() {
	const c = (await getIntegrations()).jellyseerr;
	return c?.url && c?.apiKey ? { base: normalizeUrl(c.url), apiKey: c.apiKey } : null;
}

export async function seerr(conn: { base: string; apiKey: string }, path: string, init: RequestInit = {}): Promise<any> {
	const res = await fetch(`${conn.base}/api/v1${path}`, {
		...init,
		headers: { 'X-Api-Key': conn.apiKey, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
		signal: AbortSignal.timeout(10000)
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.status === 204 ? null : res.json();
}

// The request list only carries TMDB ids; titles and posters come from the
// media endpoints. They rarely change, so they are cached for an hour.
const details = new Map<string, { at: number; title: string; year: string; poster?: string }>();
const DETAILS_TTL = 3_600_000;

async function mediaDetails(conn: { base: string; apiKey: string }, type: 'movie' | 'tv', tmdbId: number) {
	const key = `${conn.base}|${type}|${tmdbId}`;
	const hit = details.get(key);
	if (hit && Date.now() - hit.at < DETAILS_TTL) return hit;
	try {
		const m = await seerr(conn, `/${type}/${tmdbId}`);
		const date: string = (type === 'movie' ? m.releaseDate : m.firstAirDate) || '';
		const value = {
			at: Date.now(),
			title: (type === 'movie' ? m.title : m.name) || `TMDB ${tmdbId}`,
			year: date.slice(0, 4),
			poster: m.posterPath ? `https://image.tmdb.org/t/p/w92${m.posterPath}` : undefined
		};
		details.set(key, value);
		return value;
	} catch {
		return { at: 0, title: `TMDB ${tmdbId}`, year: '', poster: undefined };
	}
}

function status(r: Raw): JellyseerrStatus {
	if (r.status === 1) return 'pending';
	if (r.status === 3) return 'declined';
	if (r.status === 4) return 'failed';
	const media = r.media?.status;
	if (media === 5 || media === 4) return 'available';
	if (media === 3) return 'processing';
	return 'approved';
}

export async function toRequest(conn: { base: string; apiKey: string }, r: Raw): Promise<JellyseerrRequest> {
	const mediaType: 'movie' | 'tv' = r.type === 'tv' ? 'tv' : 'movie';
	const d = await mediaDetails(conn, mediaType, r.media?.tmdbId);
	const by = r.requestedBy || {};
	return {
		id: r.id,
		title: d.title,
		year: d.year,
		posterUrl: d.poster,
		mediaType,
		requestedBy: by.displayName || by.jellyfinUsername || by.plexUsername || by.username || by.email || 'Unknown',
		createdAt: r.createdAt,
		status: status(r)
	};
}
