import type { Entry } from '..';

export const arr = {
	'arr.failed': 'Failed to fetch',
	'arr.movie': 'Movie',
	'arr.episode': 'Episode',
	'arr.album': 'Album',
	'arr.noSources': 'No sources selected',
	'arr.none': 'No releases in the last {days} days',
	'arr.downloaded': 'Downloaded',
	'arr.missing': 'Missing',
	'arr.released': 'Released {when} · {state}',
	'arr.remove': 'Remove Arr Releases',
	'arr.edit': 'Edit releases widget',
	'arr.sub': 'SUB',
	'arr.dub': 'DUB',
	'arr.subTitle': 'French subtitles (VOSTFR) out',
	'arr.dubTitle': 'French dub (VF / MULTi) out',
	'arr.langCount': '{vostfr} VOSTFR · {vf} VF',
	'arr.langCountTitle': 'Episodes that got a VOSTFR / VF release in the last {days} days',
} satisfies Record<string, Entry>;
