import type { SpoolmanConfig, SpoolmanSection } from '$lib/types';

export const SPOOLMAN_DEFAULT_ORDER: SpoolmanSection[] = ['list', 'recent', 'low'];

/** Sections to show; widgets saved before V2.9 used `show` (they keep their look). */
export function spoolmanSections(c?: SpoolmanConfig) {
	if (c?.show && c.showRecent === undefined && c.showLow === undefined) {
		return { recent: c.show !== 'low', low: c.show !== 'recent', only: true };
	}
	const recent = !!c?.showRecent, low = !!c?.showLow;
	return { recent, low, only: !!c?.showOnly && (recent || low) };
}

/** Saved order, cleaned up: known blocks once each, missing ones appended. */
export function spoolmanOrder(c?: SpoolmanConfig): SpoolmanSection[] {
	const saved = (c?.order ?? []).filter((k, i, a) => SPOOLMAN_DEFAULT_ORDER.includes(k) && a.indexOf(k) === i);
	return [...saved, ...SPOOLMAN_DEFAULT_ORDER.filter((k) => !saved.includes(k))];
}
