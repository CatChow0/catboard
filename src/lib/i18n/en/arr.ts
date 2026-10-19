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
} satisfies Record<string, Entry>;
