import { getIntegrations } from '$lib/server/config';
import type { ArrCalendarEntry, ReleaseLanguage } from '$lib/types';
import { fetchDeezerReleases } from '$lib/server/deezer';

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
	/** Sonarr with a language filter: episodes that got a VOSTFR / VF release in the range. */
	languageCounts?: LanguageCounts;
}

export type LanguageCounts = { VOSTFR: number; VF: number };
export type LanguagePatterns = { vostfr?: string; vf?: string };

const CACHE_TTL = 300_000; // 5 minutes
/** Deezer before the app's first webhook (after it, entries stay until the next one). */
const DEEZER_TTL = 3_600_000;
const cache = new Map<string, FetchResult & { expires: number }>();
let deezerWebhookSeen = false;

/** The deezer-to-navidrome webhook: its feed or library changed, read it again. */
export function deezerChanged(): void {
	deezerWebhookSeen = true;
	for (const key of cache.keys()) if (key.startsWith('deezer:')) cache.delete(key);
}

function ttlOf(source: string, result: FetchResult): number {
	if (source !== 'deezer') return CACHE_TTL;
	// Errors are retried soon; a good feed waits for the webhook.
	if (result.error) return CACHE_TTL;
	return deezerWebhookSeen ? Number.POSITIVE_INFINITY : DEEZER_TTL;
}

export function normalizeUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

/**
 * Browser URL of an *Arr image. Images served by the *Arr app itself go
 * through CatBoard (/api/integrations/arr/image), which adds the API key
 * server-side: the key never reaches the browser. Absolute URLs (TMDB...) are
 * public and returned as they are.
 */
export function resolveUrl(source: ArrSource, maybeRelative: string): string {
	if (!maybeRelative) return '';
	if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
	const path = '/' + maybeRelative.replace(/^\/+/, '').replace(/([?&])apikey=[^&]*&?/i, '$1').replace(/[?&]$/, '');
	return `/api/integrations/arr/image?source=${source}&path=${encodeURIComponent(path)}`;
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
		console.error(`${label} error ${res.status}:`, text);
		return { error: `HTTP ${res.status}` };
	}
	const data = await res.json();
	// Paged endpoints (history) wrap their items in `records`
	return { data: Array.isArray(data) ? data : Array.isArray(data?.records) ? data.records : [] };
}

export async function fetchRadarrCalendar(conn: ArrConnection, start: string, end: string, mode: ArrDateMode = 'calendar'): Promise<FetchResult> {
	try {
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
				posterUrl: resolveUrl('radarr', rawPoster) || undefined
			};
		}).filter((e: ArrCalendarEntry) => e.date);
		return { entries };
	} catch (err: any) {
		console.error('Radarr calendar fetch error:', err?.message || err);
		return { entries: [], error: err?.message || 'Network error' };
	}
}

/** Entry of a Sonarr episode (calendar item or history record), without its date. */
function sonarrEntry(episode: any, series: any, seriesIdFallback?: number): Omit<ArrCalendarEntry, 'date'> {
	const seriesTitle = typeof series === 'object' ? series?.title : undefined;
	const seriesId = typeof series === 'object' ? series?.id : seriesIdFallback;
	const rawPoster = typeof series === 'object'
		? series?.images?.find((img: any) => img.coverType === 'poster')?.url || ''
		: '';
	// Fallback poster via seriesId if no image URL provided
	const resolvedPoster = rawPoster
		? resolveUrl('sonarr', rawPoster)
		: seriesId ? resolveUrl('sonarr', `/api/v3/MediaCover/${seriesId}/poster.jpg`) : '';
	const code = episode?.seasonNumber != null && episode?.episodeNumber != null
		? `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`
		: '';
	return {
		id: String(episode?.id || Math.random()),
		type: 'sonarr' as const,
		title: seriesTitle || 'Unknown',
		subtitle: [code, episode?.title || ''].filter(Boolean).join(' · '),
		hasFile: !!episode?.hasFile,
		posterUrl: resolvedPoster || undefined
	};
}

export async function fetchSonarrCalendar(conn: ArrConnection, start: string, end: string): Promise<FetchResult> {
	try {
		const { data, error } = await arrGet(conn, `/api/v3/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&unmonitored=true&includeSeries=true`, 'Sonarr');
		if (!data) return { entries: [], error };
		const entries = data
			.map((item: any) => ({ ...sonarrEntry(item, item.series, item.seriesId), date: toDay(item.airDateUtc) }))
			.filter((e: ArrCalendarEntry) => e.date);
		return { entries };
	} catch (err: any) {
		console.error('Sonarr calendar fetch error:', err?.message || err);
		return { entries: [], error: err?.message || 'Network error' };
	}
}

// --- Sonarr release languages (VO / VOSTFR / VF) ---

const LANGUAGE_ORDER: ReleaseLanguage[] = ['VO', 'VOSTFR', 'VF'];
export const DEFAULT_LANGUAGE_PATTERNS = {
	vostfr: '\\bVOSTFR\\b',
	vf: '\\b(VF|VFF|VFQ|TRUEFRENCH|FRENCH|MULTI)\\b'
} as const;
/** History records read per refresh (newest first). */
const HISTORY_PAGE_SIZE = 100;

function compilePattern(source: string | undefined, fallback: string): RegExp {
	if (source && source.length <= 200) {
		try {
			return new RegExp(source, 'i');
		} catch { /* invalid override: keep the default */ }
	}
	return new RegExp(fallback, 'i');
}

/**
 * Versions in a release name: VOSTFR (French subs), VF (French dub, MULTi
 * included), both, or VO when neither matches. The only place that knows the
 * patterns; the widget config can replace them.
 */
export function detectReleaseLanguages(sourceTitle: string, patterns: LanguagePatterns = {}): ReleaseLanguage[] {
	const title = sourceTitle || '';
	const found: ReleaseLanguage[] = [];
	if (compilePattern(patterns.vostfr, DEFAULT_LANGUAGE_PATTERNS.vostfr).test(title)) found.push('VOSTFR');
	if (compilePattern(patterns.vf, DEFAULT_LANGUAGE_PATTERNS.vf).test(title)) found.push('VF');
	return found.length ? found : ['VO'];
}

/** An episode with the most recent day each version came out. */
export interface EpisodeVersions {
	entry: Omit<ArrCalendarEntry, 'date'>;
	dates: Partial<Record<ReleaseLanguage, string>>;
}

const latest = (a: string | undefined, b: string) => (a && a > b ? a : b);

/** Grabbed (1) or imported (3) records, grouped by episode. Sonarr sends the event type as a string or a number. */
export function groupSonarrHistory(records: any[], start: string, patterns: LanguagePatterns = {}): EpisodeVersions[] {
	const byEpisode = new Map<string, EpisodeVersions>();
	for (const rec of records) {
		const event = rec?.eventType;
		if (!(event === 1 || event === 3 || event === 'grabbed' || event === 'downloadFolderImported')) continue;
		const day = toDay(rec.date);
		const episodeId = rec.episodeId ?? rec.episode?.id;
		if (!day || day < start || episodeId == null) continue;
		const key = String(episodeId);
		let group = byEpisode.get(key);
		if (!group) {
			group = { entry: sonarrEntry({ ...rec.episode, id: episodeId }, rec.series, rec.seriesId), dates: {} };
			byEpisode.set(key, group);
		}
		for (const lang of detectReleaseLanguages(rec.sourceTitle, patterns)) {
			group.dates[lang] = latest(group.dates[lang], day);
		}
	}
	return [...byEpisode.values()];
}

/**
 * Calendar air dates (VO) merged with the history versions, by episode. An
 * episode stays when one of its versions is in `languages`; its date is the
 * latest of those, so an old VO episode moves up when its VF comes out.
 */
export function mergeSonarrLanguages(
	calendar: ArrCalendarEntry[],
	history: EpisodeVersions[],
	languages: ReleaseLanguage[]
): { entries: ArrCalendarEntry[]; languageCounts: LanguageCounts } {
	const episodes = new Map<string, EpisodeVersions>();
	for (const { date, ...entry } of calendar) episodes.set(entry.id, { entry, dates: { VO: date } });
	for (const h of history) {
		const known = episodes.get(h.entry.id);
		if (!known) {
			episodes.set(h.entry.id, { entry: h.entry, dates: { ...h.dates } });
			continue;
		}
		known.entry = { ...known.entry, hasFile: known.entry.hasFile || h.entry.hasFile };
		for (const [lang, day] of Object.entries(h.dates) as [ReleaseLanguage, string][]) {
			known.dates[lang] = latest(known.dates[lang], day);
		}
	}

	const languageCounts: LanguageCounts = { VOSTFR: 0, VF: 0 };
	const entries: ArrCalendarEntry[] = [];
	for (const { entry, dates } of episodes.values()) {
		if (dates.VOSTFR) languageCounts.VOSTFR++;
		if (dates.VF) languageCounts.VF++;
		const date = languages.map((l) => dates[l]).filter((d): d is string => !!d).sort().pop();
		if (!date) continue;
		entries.push({ ...entry, date, languages: LANGUAGE_ORDER.filter((l) => dates[l]) });
	}
	return { entries, languageCounts };
}

export async function fetchSonarrHistory(conn: ArrConnection, start: string, patterns: LanguagePatterns = {}): Promise<{ groups: EpisodeVersions[]; error?: string }> {
	try {
		const { data, error } = await arrGet(conn, `/api/v3/history?page=1&pageSize=${HISTORY_PAGE_SIZE}&sortKey=date&sortDirection=descending&includeSeries=true&includeEpisode=true`, 'Sonarr history');
		if (!data) return { groups: [], error };
		return { groups: groupSonarrHistory(data, start, patterns) };
	} catch (err: any) {
		console.error('Sonarr history fetch error:', err?.message || err);
		return { groups: [], error: err?.message || 'Network error' };
	}
}

/** Sonarr calendar + history (fetched in parallel), filtered by version. One failing keeps the other. */
async function fetchSonarrLanguages(conn: ArrConnection, start: string, end: string, languages: ReleaseLanguage[], patterns: LanguagePatterns): Promise<FetchResult> {
	const [calendar, history] = await Promise.all([fetchSonarrCalendar(conn, start, end), fetchSonarrHistory(conn, start, patterns)]);
	const { entries, languageCounts } = mergeSonarrLanguages(calendar.entries, history.groups, languages);
	const error = [calendar.error, history.error && `history ${history.error}`].filter(Boolean).join(', ') || undefined;
	return { entries, languageCounts, error };
}

export async function fetchLidarrCalendar(conn: ArrConnection, start: string, end: string): Promise<FetchResult> {
	try {
		const { data, error } = await arrGet(conn, `/api/v1/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&unmonitored=true&includeArtist=true`, 'Lidarr');
		if (!data) return { entries: [], error };
		const entries = data.map((item: any) => {
			const artistName = typeof item.artist === 'object' ? item.artist?.artistName : undefined;
			const artistId = typeof item.artist === 'object' ? item.artist?.id : undefined;
			const rawPoster = typeof item.artist === 'object'
				? item.artist?.images?.find((img: any) => img.coverType === 'poster')?.url || ''
				: '';
			const resolvedPoster = rawPoster
				? resolveUrl('lidarr', rawPoster)
				: artistId ? resolveUrl('lidarr', `/api/v1/MediaCover/${artistId}/poster.jpg`) : '';
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
	mode: ArrDateMode = 'calendar',
	opts: { includeFeatures?: boolean; languages?: ReleaseLanguage[]; languagePatterns?: LanguagePatterns } = {}
): Promise<{ entries: ArrCalendarEntry[]; errors: { source: string; message: string }[]; languageCounts?: LanguageCounts }> {
	const integrations = await getIntegrations();
	const languages = opts.languages?.length ? opts.languages : undefined;
	const patterns = opts.languagePatterns || {};

	const results = await Promise.all(sources.map(async (source) => {
		const langKey = source === 'sonarr' && languages ? `:${languages.join('+')}:${patterns.vostfr || ''}:${patterns.vf || ''}` : '';
		const cacheKey = `${source}:${start}:${end}:${mode}:${opts.includeFeatures ? 'f' : ''}${langKey}`;
		const cached = cache.get(cacheKey);
		if (cached && cached.expires > Date.now()) {
			return { source, entries: cached.entries, error: cached.error, languageCounts: cached.languageCounts };
		}

		let result: FetchResult;
		if (source === 'radarr') {
			if (!integrations.radarr) return { source, entries: [], error: 'Not configured' };
			result = await fetchRadarrCalendar(integrations.radarr, start, end, mode);
		} else if (source === 'sonarr') {
			if (!integrations.sonarr) return { source, entries: [], error: 'Not configured' };
			result = languages
				? await fetchSonarrLanguages(integrations.sonarr, start, end, languages, patterns)
				: await fetchSonarrCalendar(integrations.sonarr, start, end);
		} else if (source === 'lidarr') {
			if (!integrations.lidarr) return { source, entries: [], error: 'Not configured' };
			result = await fetchLidarrCalendar(integrations.lidarr, start, end);
		} else if (source === 'deezer') {
			if (!integrations.deezer?.url) return { source, entries: [], error: 'Not configured' };
			result = await fetchDeezerReleases(integrations.deezer, start, end, opts);
		} else {
			return { source, entries: [], error: 'Unknown source' };
		}

		cache.set(cacheKey, { ...result, expires: Date.now() + ttlOf(source, result) });
		return { source, entries: result.entries, error: result.error, languageCounts: result.languageCounts };
	}));

	const entries: ArrCalendarEntry[] = [];
	const errors: { source: string; message: string }[] = [];
	let languageCounts: LanguageCounts | undefined;
	for (const res of results) {
		entries.push(...res.entries);
		if (res.error) errors.push({ source: res.source, message: res.error });
		if (res.languageCounts) languageCounts = res.languageCounts;
	}
	return { entries, errors, languageCounts };
}
