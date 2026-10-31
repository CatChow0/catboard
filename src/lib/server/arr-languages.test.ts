import { describe, it, expect } from 'vitest';
import { detectReleaseLanguages, groupSonarrHistory, mergeSonarrLanguages } from './arr';
import type { ArrCalendarEntry } from '$lib/types';

describe('detectReleaseLanguages', () => {
	it('reads the versions from the release name', () => {
		expect(detectReleaseLanguages('[Team] Frieren - S01E05 VOSTFR 1080p')).toEqual(['VOSTFR']);
		expect(detectReleaseLanguages('Frieren.S01E05.FRENCH.1080p.WEB')).toEqual(['VF']);
		expect(detectReleaseLanguages('Frieren.S01E05.MULTi.1080p')).toEqual(['VF']);
		expect(detectReleaseLanguages('Frieren.S01E05.VFQ.720p')).toEqual(['VF']);
		expect(detectReleaseLanguages('Frieren.S01E05.TrueFrench.1080p')).toEqual(['VF']);
		expect(detectReleaseLanguages('Frieren S01E05 MULTi VOSTFR 1080p')).toEqual(['VOSTFR', 'VF']);
	});

	it('falls back to VO and ignores partial words', () => {
		expect(detectReleaseLanguages('[SubsPlease] Frieren - 05 (1080p)')).toEqual(['VO']);
		expect(detectReleaseLanguages('Frenchie.S01E01.1080p')).toEqual(['VO']);
		expect(detectReleaseLanguages('')).toEqual(['VO']);
	});

	it('takes custom patterns and keeps the default on an invalid one', () => {
		expect(detectReleaseLanguages('Show.S01E01.SUBFRENCH', { vostfr: 'SUBFRENCH' })).toEqual(['VOSTFR']);
		expect(detectReleaseLanguages('Show.S01E01.FRENCH', { vf: '\\bDUBFR\\b' })).toEqual(['VO']);
		expect(detectReleaseLanguages('Show.S01E01.VOSTFR', { vostfr: '(' })).toEqual(['VOSTFR']);
	});
});

const rec = (episodeId: number, sourceTitle: string, date: string, eventType: string | number = 'downloadFolderImported') => ({
	episodeId,
	seriesId: 7,
	sourceTitle,
	date: `${date}T12:00:00Z`,
	eventType,
	episode: { id: episodeId, seasonNumber: 1, episodeNumber: episodeId, title: `Ep ${episodeId}`, hasFile: true },
	series: { id: 7, title: 'Frieren', images: [] }
});

describe('groupSonarrHistory', () => {
	it('groups the versions of an episode with their latest day', () => {
		const groups = groupSonarrHistory([
			rec(1, 'Frieren 01 VF', '2026-10-20'),
			rec(1, 'Frieren 01 VOSTFR', '2026-10-10', 1),
			rec(1, 'Frieren 01 VOSTFR', '2026-10-12', 'grabbed'),
			rec(1, 'Frieren 01', '2026-10-01'),
			rec(2, 'Frieren 02 VOSTFR', '2026-10-15', 'episodeFileDeleted'),
			rec(3, 'Frieren 03 VOSTFR', '2026-09-01')
		], '2026-09-15');
		expect(groups).toHaveLength(1);
		expect(groups[0].entry.subtitle).toBe('S01E01 · Ep 1');
		expect(groups[0].dates).toEqual({ VF: '2026-10-20', VOSTFR: '2026-10-12', VO: '2026-10-01' });
	});
});

describe('mergeSonarrLanguages', () => {
	const calendar: ArrCalendarEntry[] = [
		{ id: '1', type: 'sonarr', title: 'Frieren', date: '2026-10-01', hasFile: false },
		{ id: '9', type: 'sonarr', title: 'Other', date: '2026-10-05', hasFile: true }
	];
	const history = groupSonarrHistory([
		rec(1, 'Frieren 01 VOSTFR', '2026-10-12'),
		rec(1, 'Frieren 01 MULTi', '2026-10-20'),
		rec(2, 'Frieren 02 VOSTFR', '2026-10-18')
	], '2026-10-01');

	it('keeps the episodes out in the chosen versions, dated by the latest of them', () => {
		const { entries, languageCounts } = mergeSonarrLanguages(calendar, history, ['VOSTFR']);
		expect(entries.map((e) => [e.id, e.date])).toEqual([['1', '2026-10-12'], ['2', '2026-10-18']]);
		expect(entries[0].languages).toEqual(['VO', 'VOSTFR', 'VF']);
		expect(entries[0].hasFile).toBe(true);
		expect(languageCounts).toEqual({ VOSTFR: 2, VF: 1 });
	});

	it('moves an old VO episode up when its VF comes out', () => {
		const { entries } = mergeSonarrLanguages(calendar, history, ['VO', 'VF']);
		expect(entries.find((e) => e.id === '1')?.date).toBe('2026-10-20');
		expect(entries.find((e) => e.id === '9')?.languages).toEqual(['VO']);
		expect(entries.some((e) => e.id === '2')).toBe(false);
	});
});
