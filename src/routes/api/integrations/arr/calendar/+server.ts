import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getIntegrations } from '$lib/server/config';
import type { ArrCalendarEntry } from '$lib/types';

interface ArrConnection {
	url: string;
	apiKey: string;
}

const CACHE_TTL = 300_000; // 5 minutes
const cache = new Map<string, { entries: ArrCalendarEntry[]; error?: string; expires: number }>();

function normalizeUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

function resolveUrl(base: string, maybeRelative: string, apiKey: string): string {
	if (!maybeRelative) return '';
	if (maybeRelative.startsWith('http')) return maybeRelative;
	const url = normalizeUrl(base) + '/' + maybeRelative.replace(/^\/+/, '');
	const sep = url.includes('?') ? '&' : '?';
	return `${url}${sep}apikey=${encodeURIComponent(apiKey)}`;
}

function getCacheKey(source: string, start: string, end: string): string {
	return `${source}:${start}:${end}`;
}

async function fetchRadarrCalendar(conn: ArrConnection, start: string, end: string): Promise<{ entries: ArrCalendarEntry[]; error?: string }> {
	try {
		const base = normalizeUrl(conn.url);
		const res = await fetch(`${base}/api/v3/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&unmonitored=true`, {
			headers: { 'X-Api-Key': conn.apiKey, 'Accept': 'application/json' },
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			console.error(`Radarr calendar error ${res.status}:`, text);
			return { entries: [], error: `HTTP ${res.status}` };
		}
		const data = await res.json();
		if (!Array.isArray(data)) return { entries: [] };
		const entries = data.map((item: any) => {
			const physical = item.physicalRelease;
			const digital = item.digitalRelease;
			const cinema = item.inCinemas;
			const date = physical || digital || cinema || item.releaseDate || item.airDateUtc;
			const rawPoster = item.images?.find((img: any) => img.coverType === 'poster')?.url || '';
			return {
				id: String(item.id || item.tmdbId || Math.random()),
				type: 'radarr' as const,
				title: item.title || 'Unknown',
				subtitle: item.year ? String(item.year) : undefined,
				date: date ? date.split('T')[0] : '',
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

async function fetchSonarrCalendar(conn: ArrConnection, start: string, end: string): Promise<{ entries: ArrCalendarEntry[]; error?: string }> {
	try {
		const base = normalizeUrl(conn.url);
		const res = await fetch(`${base}/api/v3/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&unmonitored=true&includeSeries=true`, {
			headers: { 'X-Api-Key': conn.apiKey, 'Accept': 'application/json' },
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			console.error(`Sonarr calendar error ${res.status}:`, text);
			return { entries: [], error: `HTTP ${res.status}` };
		}
		const data = await res.json();
		if (!Array.isArray(data)) return { entries: [] };
		const entries = data.map((item: any) => {
			const date = item.airDateUtc ? item.airDateUtc.split('T')[0] : '';
			const seriesTitle = typeof item.series === 'object' ? item.series?.title : undefined;
			const seriesId = typeof item.series === 'object' ? item.series?.id : item.seriesId;
			const episode = item.title || '';
			const rawPoster = typeof item.series === 'object'
				? item.series?.images?.find((img: any) => img.coverType === 'poster')?.url || ''
				: '';
			// Fallback poster via seriesId if no image URL provided
			const resolvedPoster = rawPoster
				? resolveUrl(base, rawPoster, conn.apiKey)
				: seriesId ? resolveUrl(base, `/api/v3/MediaCover/${seriesId}/poster.jpg`, conn.apiKey) : '';
			return {
				id: String(item.id || Math.random()),
				type: 'sonarr' as const,
				title: seriesTitle || 'Unknown',
				subtitle: episode,
				date,
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

async function fetchLidarrCalendar(conn: ArrConnection, start: string, end: string): Promise<{ entries: ArrCalendarEntry[]; error?: string }> {
	try {
		const base = normalizeUrl(conn.url);
		const res = await fetch(`${base}/api/v1/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&unmonitored=true&includeArtist=true`, {
			headers: { 'X-Api-Key': conn.apiKey, 'Accept': 'application/json' },
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			console.error(`Lidarr calendar error ${res.status}:`, text);
			return { entries: [], error: `HTTP ${res.status}` };
		}
		const data = await res.json();
		if (!Array.isArray(data)) return { entries: [] };
		const entries = data.map((item: any) => {
			const date = item.releaseDate ? item.releaseDate.split('T')[0] : '';
			const artistName = typeof item.artist === 'object' ? item.artist?.artistName : undefined;
			const artistId = typeof item.artist === 'object' ? item.artist?.id : undefined;
			const album = item.title || '';
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
				subtitle: album,
				date,
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

export const GET: RequestHandler = async ({ url }) => {
	const sourcesParam = url.searchParams.get('sources') || '';
	const start = url.searchParams.get('start') || '';
	const end = url.searchParams.get('end') || '';

	if (!sourcesParam || !start || !end) {
		return json({ entries: [], updatedAt: Date.now(), errors: [] });
	}

	const integrations = await getIntegrations();
	const sources = sourcesParam.split(',').filter(Boolean);
	const allEntries: ArrCalendarEntry[] = [];
	const errors: { source: string; message: string }[] = [];

	// Build parallel fetch tasks with cache check
	const tasks = sources.map(async (source) => {
		const cacheKey = getCacheKey(source, start, end);
		const cached = cache.get(cacheKey);
		if (cached && cached.expires > Date.now()) {
			return { source, entries: cached.entries, error: cached.error };
		}

		let result: { entries: ArrCalendarEntry[]; error?: string };
		if (source === 'radarr') {
			if (!integrations.radarr) {
				return { source, entries: [], error: 'Not configured' };
			}
			result = await fetchRadarrCalendar(integrations.radarr, start, end);
		} else if (source === 'sonarr') {
			if (!integrations.sonarr) {
				return { source, entries: [], error: 'Not configured' };
			}
			result = await fetchSonarrCalendar(integrations.sonarr, start, end);
		} else if (source === 'lidarr') {
			if (!integrations.lidarr) {
				return { source, entries: [], error: 'Not configured' };
			}
			result = await fetchLidarrCalendar(integrations.lidarr, start, end);
		} else {
			return { source, entries: [], error: 'Unknown source' };
		}

		cache.set(cacheKey, { ...result, expires: Date.now() + CACHE_TTL });
		return { source, entries: result.entries, error: result.error };
	});

	const results = await Promise.all(tasks);

	for (const res of results) {
		allEntries.push(...res.entries);
		if (res.error) errors.push({ source: res.source, message: res.error });
	}

	return json({
		entries: allEntries.sort((a, b) => a.date.localeCompare(b.date)),
		updatedAt: Date.now(),
		errors
	});
};
