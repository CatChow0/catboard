import type { Entry } from '..';

export const misc = {
	'dashboard.selected': { one: '{count} selected tile', other: '{count} selected tiles' },
	'dashboard.missingService': 'Service not found',
	'dashboard.loading': 'Loading dashboard...',
	'icons.badUrl': 'Enter an http(s) image URL',
	'icons.tooLarge': 'Image too large (max 1 MB)',
	'jellyfin.type.movie': 'Movie',
	'jellyfin.type.episode': 'Episode',
	'jellyfin.type.series': 'Series',
	'jellyfin.type.season': 'Season',
	'jellyfin.type.album': 'Album',
	'jellyfin.type.music': 'Music',
	'jellyfin.type.audio': 'Audio',
	'jellyfin.type.video': 'Video',
	'jellyfin.type.book': 'Book',
	'ws.enableSectionFirst': 'Enable a section first',
} satisfies Record<string, Entry>;
