// Horizontal swipe to switch dashboards: a quick, mostly horizontal finger
// move of at least MIN_PX. Finger moving left brings the next dashboard.

export const SWIPE_MIN_PX = 60;
export const SWIPE_MAX_MS = 600;

export type SwipeStart = { x: number; y: number; t: number };

export function swipeDirection(start: SwipeStart, end: { x: number; y: number; t: number }): 'next' | 'prev' | null {
	if (end.t - start.t > SWIPE_MAX_MS) return null;
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
	return dx < 0 ? 'next' : 'prev';
}
