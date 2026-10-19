import type { Entry } from '..';

export const jellyfin = {
	'jellyfin.transcode': 'Transcode',
	'jellyfin.directStream': 'Direct stream',
	'jellyfin.directPlay': 'Direct play',
	'jellyfin.nowPlaying': 'Now playing',
	'jellyfin.nothing': 'Nothing playing right now',
	'jellyfin.paused': 'Paused',
	'jellyfin.noRecent': 'No recent items',
	'jellyfin.added': 'Added {date}',
	'jellyfin.remove': 'Remove Jellyfin Latest',
} satisfies Record<string, Entry>;
