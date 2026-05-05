import { json, type RequestHandler } from '@sveltejs/kit';
import { getIntegrations } from '$lib/server/config';
import type { JellyfinLatestData, JellyfinMediaItem } from '$lib/types';

function normalizeUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

function buildImageUrl(baseUrl: string, itemId: string, imageType: string, tag: string, index?: number): string {
	let url = `${baseUrl}/Items/${itemId}/Images/${imageType}?tag=${tag}`;
	if (imageType === 'Backdrop') {
		url += '&maxWidth=800';
		if (index !== undefined) url += `&index=${index}`;
	} else if (imageType === 'Primary') {
		url += '&maxHeight=300';
	}
	return url;
}

async function getJellyfinUserId(baseUrl: string, apiKey: string): Promise<string | null> {
	try {
		const res = await fetch(`${baseUrl}/Users`, {
			headers: { 'X-Emby-Token': apiKey, Accept: 'application/json' },
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) return null;
		const users = await res.json();
		if (Array.isArray(users) && users.length > 0) {
			return users[0].Id || users[0].id || null;
		}
		return null;
	} catch {
		return null;
	}
}

function mapJellyfinType(type: string): string {
	switch (type) {
		case 'Movie': return 'Movie';
		case 'Series': return 'TV Show';
		case 'Season': return 'Season';
		case 'Episode': return 'Episode';
		case 'MusicAlbum': return 'Album';
		case 'Audio': return 'Music';
		case 'Video': return 'Video';
		case 'Book': return 'Book';
		default: return type;
	}
}

function formatDate(dateStr: string): string {
	try {
		const d = new Date(dateStr);
		return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	} catch {
		return dateStr;
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const integrations = await getIntegrations();
	const conn = integrations.jellyfin;
	if (!conn?.url || !conn?.apiKey) {
		return json({ error: 'Jellyfin not configured' }, { status: 404 });
	}

	const baseUrl = normalizeUrl(conn.url);
	const apiKey = conn.apiKey;
	const instanceId = url.searchParams.get('instanceId') || 'default';
	const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '5', 10), 1), 20);

	let userId: string | null = url.searchParams.get('userId');
	if (!userId) {
		userId = await getJellyfinUserId(baseUrl, apiKey);
	}
	if (!userId) {
		return json({ error: 'Could not determine Jellyfin user' }, { status: 500 });
	}

	try {
		const res = await fetch(
			`${baseUrl}/Users/${userId}/Items/Latest?Limit=${limit}&Fields=PrimaryImageAspectRatio,Overview,DateCreated,Type,PremiereDate,ImageTags,BackdropImageTags`,
			{
				headers: { 'X-Emby-Token': apiKey, Accept: 'application/json' },
				signal: AbortSignal.timeout(15000)
			}
		);
		if (!res.ok) {
			return json({ error: `Jellyfin API error: ${res.status}` }, { status: res.status });
		}

		const raw = await res.json();
		const rawItems = Array.isArray(raw) ? raw : raw.Items || [];

		const items: JellyfinMediaItem[] = rawItems.map((item: Record<string, unknown>) => {
			const id = (item.Id as string) || (item.id as string) || '';
			const type = (item.Type as string) || 'Unknown';
			const imageTags = item.ImageTags as Record<string, string> | undefined;
			const backdropTags = item.BackdropImageTags as string[] | undefined;
			const parentBackdropTags = item.ParentBackdropImageTags as string[] | undefined;
			const primaryTag = imageTags?.Primary;
			const backdropTag = backdropTags?.[0] || parentBackdropTags?.[0];

			let imageUrl: string | undefined;
			let backdropUrl: string | undefined;

			if (backdropTag) {
				backdropUrl = buildImageUrl(baseUrl, id, 'Backdrop', backdropTag, 0);
			}
			if (primaryTag) {
				imageUrl = buildImageUrl(baseUrl, id, 'Primary', primaryTag);
				if (!backdropUrl) backdropUrl = imageUrl;
			}

			return {
				id,
				name: (item.Name as string) || 'Unknown',
				overview: (item.Overview as string) || '',
				type: mapJellyfinType(type),
				dateCreated: formatDate((item.DateCreated as string) || (item.PremiereDate as string) || ''),
				imageUrl,
				backdropUrl
			};
		});

		const data: JellyfinLatestData = {
			instanceId,
			items,
			updatedAt: Date.now()
		};

		return json(data, {
			headers: { 'Cache-Control': 'max-age=300' }
		});
	} catch {
		return json({ error: 'Failed to fetch Jellyfin data' }, { status: 500 });
	}
};
