import { json, type RequestHandler } from '@sveltejs/kit';
import { getIntegrations } from '$lib/server/config';
import { normalizeUrl } from '$lib/server/arr';
import { jellyfinImagePath, ticksToSeconds } from '$lib/server/jellyfin';
import type { JellyfinSession } from '$lib/types';

type Raw = Record<string, any>;

/** Best artwork for what is playing: backdrop first, then the poster/cover. */
function artwork(item: Raw): string | undefined {
	if (item.BackdropImageTags?.[0]) return jellyfinImagePath(item.Id, 'Backdrop', item.BackdropImageTags[0], 800);
	if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.[0])
		return jellyfinImagePath(item.ParentBackdropItemId, 'Backdrop', item.ParentBackdropImageTags[0], 800);
	if (item.SeriesId && item.SeriesPrimaryImageTag) return jellyfinImagePath(item.SeriesId, 'Primary', item.SeriesPrimaryImageTag, 400);
	if (item.AlbumId && item.AlbumPrimaryImageTag) return jellyfinImagePath(item.AlbumId, 'Primary', item.AlbumPrimaryImageTag, 400);
	if (item.ImageTags?.Primary) return jellyfinImagePath(item.Id, 'Primary', item.ImageTags.Primary, 400);
	return undefined;
}

function titles(item: Raw): { title: string; subtitle: string } {
	if (item.Type === 'Episode') {
		const s = String(item.ParentIndexNumber ?? 0).padStart(2, '0');
		const e = String(item.IndexNumber ?? 0).padStart(2, '0');
		return { title: item.SeriesName || item.Name, subtitle: `S${s}E${e} · ${item.Name}` };
	}
	if (item.Type === 'Audio') return { title: item.Name, subtitle: [item.AlbumArtist || item.Artists?.[0], item.Album].filter(Boolean).join(' · ') };
	return { title: item.Name, subtitle: item.ProductionYear ? String(item.ProductionYear) : '' };
}

function transcodeInfo(s: Raw): string {
	const t = s.TranscodingInfo;
	if (!t) return '';
	const parts: string[] = [];
	const codecs = [t.VideoCodec, t.AudioCodec].filter(Boolean).map((c: string) => c.toUpperCase());
	if (codecs.length) parts.push(codecs.join(' / '));
	if (t.Bitrate) parts.push(`${(t.Bitrate / 1_000_000).toFixed(1)} Mbps`);
	if (t.IsVideoDirect) parts.push('video direct');
	const reasons = (t.TranscodeReasons as string[] | undefined)?.map((r) => r.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
	if (reasons?.length) parts.push(reasons.join(', '));
	return parts.join(' · ');
}

/** Streams currently playing on Jellyfin. */
export const GET: RequestHandler = async () => {
	const conn = (await getIntegrations()).jellyfin;
	if (!conn?.url || !conn?.apiKey) return json({ error: 'Jellyfin not configured' }, { status: 404 });
	try {
		const res = await fetch(`${normalizeUrl(conn.url)}/Sessions?activeWithinSeconds=960`, {
			headers: { 'X-Emby-Token': conn.apiKey, Accept: 'application/json' },
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) return json({ error: `Jellyfin answered HTTP ${res.status}` }, { status: 502 });
		const raw = (await res.json()) as Raw[];
		const sessions: JellyfinSession[] = raw
			.filter((s) => s.NowPlayingItem)
			.map((s) => {
				const item = s.NowPlayingItem;
				const method = s.PlayState?.PlayMethod;
				return {
					id: s.Id,
					user: s.UserName || 'Unknown',
					device: s.DeviceName || '',
					client: s.Client || '',
					...titles(item),
					mediaType: item.Type || 'Unknown',
					positionSec: ticksToSeconds(s.PlayState?.PositionTicks),
					runtimeSec: ticksToSeconds(item.RunTimeTicks),
					paused: !!s.PlayState?.IsPaused,
					playMethod: method === 'Transcode' || method === 'DirectStream' ? method : 'DirectPlay',
					transcodeInfo: transcodeInfo(s),
					imageUrl: artwork(item)
				};
			});
		return json({ sessions, updatedAt: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (err) {
		const timeout = err instanceof Error && err.name === 'TimeoutError';
		return json({ error: timeout ? 'Jellyfin did not answer in time' : 'Cannot reach Jellyfin' }, { status: 502 });
	}
};
