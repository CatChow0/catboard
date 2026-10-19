import type { Dict } from '..';

export const dashboard = {
	'dashboard.tilesCopied': { one: 'Tuile copiée vers {target}', other: '{count} tuiles copiées vers {target}' },
	'dashboard.tilesMoved': { one: 'Tuile déplacée vers {target}', other: '{count} tuiles déplacées vers {target}' },
	'dashboard.confirmDelete': 'Supprimer {count} tuiles ?',
	'dashboard.empty': 'Cette mise en page est vide',
	'dashboard.emptyHint': 'Ajoute des services et des widgets avec le bouton + pour la mise en page {layout}',
	'dashboard.copyTo': 'Copier vers',
	'dashboard.moveTo': 'Déplacer vers',
	'dashboard.deleteTiles': { one: 'Supprimer', other: 'Supprimer {count} tuiles' },
	'dashboard.current': 'actuel',
	'dashboard.duplicate': 'dupliquer',
	'dashboard.here': 'ici',
	'dashboard.removeTile': 'Retirer du dashboard',
	'dashboard.editService': 'Modifier le service',
} satisfies Partial<Dict>;
