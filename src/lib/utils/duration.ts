// Short human durations and dates shared by widgets.
import { intlLocale, tr } from '$lib/i18n';

/** 3725 -> "1h 02m", 125 -> "2m 05s", 90061 -> "1d 1h". */
export function duration(sec: number): string {
	const s = Math.max(0, Math.round(sec));
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
	return tr('time.days', { d: Math.floor(h / 24), h: h % 24 });
}

/** Wall-clock time `sec` from now ("21:45", or "Tue 09:10" when not today). */
export function clockIn(sec: number): string {
	const end = new Date(Date.now() + sec * 1000);
	const hm = end.toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' });
	return end.toDateString() === new Date().toDateString() ? hm : `${end.toLocaleDateString(intlLocale(), { weekday: 'short' })} ${hm}`;
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function timeAgo(iso: string | null | undefined): string {
	if (!iso) return '';
	const diff = (Date.now() - Date.parse(iso)) / 1000;
	if (!Number.isFinite(diff)) return '';
	if (diff < 60) return tr('time.justNow');
	if (diff < 3600) return tr('time.minAgo', { n: Math.floor(diff / 60) });
	if (diff < 86400) return tr('time.hAgo', { n: Math.floor(diff / 3600) });
	if (diff < 30 * 86400) return tr('time.dAgo', { n: Math.floor(diff / 86400) });
	return new Date(iso).toLocaleDateString(intlLocale());
}
