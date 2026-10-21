// Deezer to Navidrome (the user's app): its release feed, recent albums, EPs
// and singles of the favorite Deezer artists, as calendar entries. The app
// builds and caches the feed itself; CatBoard reads it and asks the app which
// releases are already complete in the music library.
import { normalizeUrl } from '$lib/server/arr';
import { AppError } from '$lib/server/api-error';
import type { ArrCalendarEntry } from '$lib/types';

const TIMEOUT_MS = 10_000;
const NAME = 'Deezer to Navidrome';
/** The app checks at most 100 items per call. */
const CHECK_BATCH = 100;

export type DeezerRelease = {
	id: string;
	title: string;
	cover?: string;
	release_date: string;
	record_type?: string;
	artist?: string;
	artist_id?: string;
	nb_tracks?: number;
	featured?: boolean;
	followed?: { id: string; name: string }[];
};

export type DeezerFeed = { ok?: boolean; connected?: boolean; artists?: number; muted?: Record<string, string>; releases?: DeezerRelease[] };

export type DeezerConn = { url: string; apiToken?: string };

async function call(conn: DeezerConn, path: string, init: RequestInit = {}): Promise<Response> {
	let res: Response;
	const auth: Record<string, string> = conn.apiToken ? { Authorization: `Bearer ${conn.apiToken}` } : {};
	try {
		res = await fetch(`${normalizeUrl(conn.url)}${path}`, { ...init, headers: { Accept: 'application/json', ...auth, ...(init.headers as Record<string, string>) }, signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch {
		throw new AppError('errors.cannotReach', { name: NAME });
	}
	if (res.status === 401) throw new AppError('errors.deezerAuth');
	if (!res.ok) throw new AppError('errors.answeredHttp', { name: NAME, status: res.status });
	return res;
}

export async function deezerFeed(conn: DeezerConn): Promise<DeezerFeed> {
	const res = await call(conn, '/api/releases');
	const body = (await res.json().catch(() => null)) as DeezerFeed | null;
	if (!body || !Array.isArray(body.releases)) throw new AppError('errors.notLike', { name: NAME });
	return body;
}

// Same rule as the app's feed view: hidden when every followed artist is muted.
const followedOf = (r: DeezerRelease) => r.followed ?? [{ id: r.artist_id ?? '', name: r.artist ?? '' }];
const isMuted = (r: DeezerRelease, muted: Record<string, string>) => followedOf(r).every((a) => muted[a.id] !== undefined);

/** Owned track count per release, from the app's library check; empty when the check fails. */
async function ownedCounts(conn: DeezerConn, releases: DeezerRelease[]): Promise<Record<string, number>> {
	const owned: Record<string, number> = {};
	for (let i = 0; i < releases.length; i += CHECK_BATCH) {
		const items = releases.slice(i, i + CHECK_BATCH).map((r) => ({ key: r.id, type: 'album', title: r.title, artist: r.artist ?? '' }));
		try {
			const res = await call(conn, '/search/library-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
			const body = (await res.json()) as { ok?: boolean; results?: Record<string, { owned_count?: number }> };
			for (const [key, r] of Object.entries(body.results ?? {})) owned[key] = r?.owned_count ?? 0;
		} catch {
			// no library status for this batch: the releases are still shown
		}
	}
	return owned;
}

export async function fetchDeezerReleases(
	conn: DeezerConn,
	start: string,
	end: string,
	opts: { includeFeatures?: boolean } = {}
): Promise<{ entries: ArrCalendarEntry[]; error?: string }> {
	try {
		const feed = await deezerFeed(conn);
		const muted = feed.muted ?? {};
		const shown = (feed.releases ?? []).filter(
			(r) => r.release_date >= start && r.release_date <= end && !isMuted(r, muted) && (opts.includeFeatures || !r.featured)
		);
		const owned = await ownedCounts(conn, shown);
		const entries = shown.map((r) => ({
			id: `deezer-${r.id}`,
			type: 'deezer' as const,
			title: r.artist || followedOf(r)[0]?.name || '',
			subtitle: r.title,
			date: r.release_date,
			// In the library when every track is there (the app's own rule).
			hasFile: !!r.nb_tracks && (owned[r.id] ?? 0) >= r.nb_tracks,
			posterUrl: r.cover || undefined,
			kind: r.record_type || 'album'
		}));
		return { entries };
	} catch (err) {
		return { entries: [], error: err instanceof Error ? err.message : String(err) };
	}
}
