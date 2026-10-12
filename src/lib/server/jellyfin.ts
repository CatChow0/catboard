// Shared Jellyfin helpers. Images are served through CatBoard's own
// /api/integrations/jellyfin/image route so the browser never needs to reach
// the (often internal, plain-HTTP) Jellyfin URL.

export const JELLYFIN_IMAGE_TYPES = new Set(['Primary', 'Backdrop', 'Thumb']);

export function jellyfinImagePath(itemId: string, type: 'Primary' | 'Backdrop' | 'Thumb', tag: string, width: number): string {
	const q = new URLSearchParams({ item: itemId, type, tag, w: String(width) });
	return `/api/integrations/jellyfin/image?${q}`;
}

/** Jellyfin ticks are 100 ns. */
export const ticksToSeconds = (t: unknown) => (typeof t === 'number' ? t / 10_000_000 : 0);
