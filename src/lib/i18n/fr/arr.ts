import type { Dict } from '..';

export const arr = {
	'arr.failed': 'Chargement impossible',
	'arr.movie': 'Film',
	'arr.episode': 'Épisode',
	'arr.album': 'Album',
	'arr.noSources': 'Aucune source choisie',
	'arr.none': 'Aucune sortie ces {days} derniers jours',
	'arr.downloaded': 'Téléchargé',
	'arr.missing': 'Manquant',
	'arr.released': 'Sorti {when} · {state}',
	'arr.remove': 'Retirer les sorties Arr',
	'arr.edit': 'Modifier le widget des sorties',
	'arr.sub': 'SUB',
	'arr.dub': 'DUB',
	'arr.subTitle': 'Version sous-titrée en français (VOSTFR) disponible',
	'arr.dubTitle': 'Version doublée en français (VF / MULTi) disponible',
	'arr.langCount': '{vostfr} VOSTFR · {vf} VF',
	'arr.langCountTitle': 'Épisodes sortis en VOSTFR / VF ces {days} derniers jours',
} satisfies Partial<Dict>;
