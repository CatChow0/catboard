import { getIntegrations } from '$lib/server/config';
import type { ArrCalendarEntry } from '$lib/types';

export type ArrSource = 'radarr' | 'sonarr' | 'lidarr';

/**
 * 'calendar' picks the primary release date of a movie (physical > digital > cinema).
 * 'released' picks the most recent release date that is already past (for "new releases").
 */
export type ArrDateMode = 'calendar' | 'released';

interface ArrConnection {
	url: string;
	apiKey: string;
}

interface FetchResult {
	entries: ArrCalendarEntry[];
	error?: string;
}

const CACHE_TTL = 300_000; // 5 minutes
const cache = new Map<string, FetchResult & { expires: number }>();

export function normalizeUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

export function resolveUrl(base: string, maybeRelative: string, apiKey: string): string {
	if (!maybeRelative) return '';
	if (maybeRelative.startsWith('http')) return maybeRelative;
	const url = normalizeUrl(base) + '/' + maybeRelative.replace(/^\/+/, '');
	const sep = url.includes('?') ? '&' : '?';
	return `${url}${sep}apikey=${encodeURIComponent(apiKey)}`;
}

function toDay(value: string | undefined): string {
	return value ? value.split('T')[0] : '';
}

function pickRadarrDate(item: any, mode: ArrDateMode, today: string): string {
	if (mode === 'released') {
		const past = [item.digitalRelease, item.physicalRelease, item.inCinemas, item.releaseDate]
			.map(toDay)
			.filter((d) => d && d <= today)
			.sort();
		if (past.length) return past[past.length - 1];
	}
	return toDay(item.physicalRelease || item.digitalRelease || item.inCinemas || item.releaseDate || item.airDateUtc);
}

async function arrGet(conn: ArrConnection, path: string, label: string): Promise<{ data?: any[]; error?: string }> {
	const res = await fetch(`${normalizeUrl(conn.url)}${path}`, {
		headers: { 'X-Api-Key': conn.apiKey, 'Accept': 'application/json' },
		signal: AbortSignal.timeout(10000)
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		console.error(`${label} calendar error ${res.status}:`, text);
		return { error: `HTTP ${res.status}` };
	}
	const data = await res.json();
	return { data: Array.isArray(data) ? data : [] };
}

export async function fetchRadarrCalendar(conn: ArrConnection, start: string, end: string, mode: ArrDateMode = 'calendar'): Promise<FetchResult> {
	try {
		const base = normalizeUrl(conn.url);
		const { data, error } = await arrGet(conn, `/api/v3/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&unmonitored=true`, 'Radarr');
		if (!data) return { entries: [], error };
		const today = new Date().toISOString().split('T')[0];
		const entries = data.map((item: any) => {
			const rawPoster = item.images?.find((img: any) => img.coverType === 'poster')?.url || '';
			return {
				id: String(item.id || item.tmdbId || Math.random()),
				type: 'radarr' as const,
				title: item.title || 'Unknown',
				subtitle: item.year ? String(item.year) : undefined,
				date: pickRadarrDate(item, mode, today),
				hasFile: !!item.hasFile,
				posterUrl: resolveUrl(base, rawPoster, conn.apiKey) || undefined
			};
		}).filter((e: ArrCalendarEntry) => e.date);
		return { entries };
	} catch (err: any) {
		console.error('Radarr calendar fetch error:', err?.message || err);
		return { entries: [], error: err?.message || 'Network error' };
	}
}

export async function fetchSonarrCalendar(conn: ArrConnection, start: string, end: string): Promise<FetchResult> {
	try {
		const base = normalizeUrl(conn.url);
		const { data, error } = await arrGet(conn, `/api/v3/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&unmonitored=true&includeSeries=true`, 'Sonarr');
		if (!data) return { entries: [], error };
		const entries = data.map((item: any) => {
			const seriesTitle = typeof item.series === 'object' ? item.series?.title : undefined;
			const seriesId = typeof item.series === 'object' ? item.series?.id : item.seriesId;
			const rawPoster = typeof item.series === 'object'
				? item.series?.images?.find((img: any) => img.coverType === 'poster')?.url || ''
				: '';
			// Fallback poster via seriesId if no image URL provided
			const resolvedPoster = rawPoster
				? resolveUrl(base, rawPoster, conn.apiKey)
				: seriesId ? resolveUrl(base, `/api/v3/MediaCover/${seriesId}/poster.jpg`, conn.apiKey) : '';
			const code = item.seasonNumber != null && item.episodeNumber != null
				? `S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')}`
				: '';
			return {
				id: String(item.id || Math.random()),
				type: 'sonarr' as const,
				title: seriesTitle || 'Unknown',
				subtitle: [code, item.title || ''].filter(Boolean).join(' · '),
				date: toDay(item.airDateUtc),
				hasFile: !!item.hasFile,
				posterUrl: resolvedPoster || undefined
			};
		}).filter((e: ArrCalendarEntry) => e.date);
		return { entries };
	} catch (err: any) {
		console.error('Sonarr calendar fetch error:', err?.message || err);
		return { entries: [], error: err?.message || 'Network error' };
	}
}

export async function fetchLidarrCalendar(conn: ArrConnection, start: string, end: string): Promise<FetchResult> {
	try {
		const base = normalizeUrl(conn.url);
		const { data, error } = await arrGet(conn, `/api/v1/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&unmonitored=true&includeArtist=true`, 'Lidarr');
		if (!data) return { entries: [], error };
		const entries = data.map((item: any) => {
			const artistName = typeof item.artist === 'object' ? item.artist?.artistName : undefined;
			const artistId = typeof item.artist === 'object' ? item.artist?.id : undefined;
			const rawPoster = typeof item.artist === 'object'
				? item.artist?.images?.find((img: any) => img.coverType === 'poster')?.url || ''
				: '';
			const resolvedPoster = rawPoster
				? resolveUrl(base, rawPoster, conn.apiKey)
				: artistId ? resolveUrl(base, `/api/v1/MediaCover/${artistId}/poster.jpg`, conn.apiKey) : '';
			return {
				id: String(item.id || Math.random()),
				type: 'lidarr' as const,
				title: artistName || 'Unknown',
				subtitle: item.title || '',
				date: toDay(item.releaseDate),
				hasFile: !!item.tracks?.some((t: any) => t.hasFile),
				posterUrl: resolvedPoster || undefined
			};
		}).filter((e: ArrCalendarEntry) => e.date);
		return { entries };
	} catch (err: any) {
		console.error('Lidarr calendar fetch error:', err?.message || err);
		return { entries: [], error: err?.message || 'Network error' };
	}
}

/** Fetch entries from several *Arr sources in parallel, with a 5 min in-memory cache per source/range/mode. */
export async function fetchArrEntries(
	sources: string[],
	start: string,
	end: string,
	mode: ArrDateMode = 'calendar'
): Promise<{ entries: ArrCalendarEntry[]; errors: { source: string; message: string }[] }> {
	const integrations = await getIntegrations();

	const results = await Promise.all(sources.map(async (source) => {
		const cacheKey = `${source}:${start}:${end}:${mode}`;
		const cached = cache.get(cacheKey);
		if (cached && cached.expires > Date.now()) {
			return { source, entries: cached.entries, error: cached.error };
		}

		let result: FetchResult;
		if (source === 'radarr') {
			if (!integrations.radarr) return { source, entries: [], error: 'Not configured' };
			result = await fetchRadarrCalendar(integrations.radarr, start, end, mode);
		} else if (source === 'sonarr') {
			if (!integrations.sonarr) return { source, entries: [], error: 'Not configured' };
			result = await fetchSonarrCalendar(integrations.sonarr, start, end);
		} else if (source === 'lidarr') {
			if (!integrations.lidarr) return { source, entries: [], error: 'Not configured' };
			result = await fetchLidarrCalendar(integrations.lidarr, start, end);
		} else {
			return { source, entries: [], error: 'Unknown source' };
		}

		cache.set(cacheKey, { ...result, expires: Date.now() + CACHE_TTL });
		return { source, entries: result.entries, error: result.error };
	}));

	const entries: ArrCalendarEntry[] = [];
	const errors: { source: string; message: string }[] = [];
	for (const res of results) {
		entries.push(...res.entries);
		if (res.error) errors.push({ source: res.source, message: res.error });
	}
	return { entries, errors };
}
