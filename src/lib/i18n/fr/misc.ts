import type { Dict } from '..';

export const misc = {
	'dashboard.selected': { one: '{count} tuile sélectionnée', other: '{count} tuiles sélectionnées' },
	'dashboard.missingService': 'Service introuvable',
	'dashboard.loading': 'Chargement du dashboard...',
	'icons.badUrl': 'Saisis l\'URL http(s) d\'une image',
	'icons.tooLarge': 'Image trop lourde (1 Mo max)',
	'jellyfin.type.movie': 'Film',
	'jellyfin.type.episode': 'Épisode',
	'jellyfin.type.series': 'Série',
	'jellyfin.type.season': 'Saison',
	'jellyfin.type.album': 'Album',
	'jellyfin.type.music': 'Musique',
	'jellyfin.type.audio': 'Audio',
	'jellyfin.type.video': 'Vidéo',
	'jellyfin.type.book': 'Livre',
	'ws.enableSectionFirst': 'Active d\'abord une section',
} satisfies Partial<Dict>;
