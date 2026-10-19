import type { Dict } from '..';

export const jellyfin = {
	'jellyfin.transcode': 'Transcodage',
	'jellyfin.directStream': 'Flux direct',
	'jellyfin.directPlay': 'Lecture directe',
	'jellyfin.nowPlaying': 'Lecture en cours',
	'jellyfin.nothing': 'Rien en lecture pour le moment',
	'jellyfin.paused': 'En pause',
	'jellyfin.noRecent': 'Aucun ajout récent',
	'jellyfin.added': 'Ajouté le {date}',
	'jellyfin.remove': 'Retirer les derniers ajouts Jellyfin',
} satisfies Partial<Dict>;
