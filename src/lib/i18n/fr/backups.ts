import type { Dict } from '..';

export const backups = {
	'backups.title': 'Sauvegardes',
	'backups.now': 'Sauvegarder maintenant',
	'backups.hint': 'Une copie de la configuration (services, mise en page, intégrations, utilisateurs, réglages) est faite chaque jour avant la première modification, et avant chaque import ou restauration. Les 14 dernières sauvegardes quotidiennes sont gardées.',
	'backups.none': 'Aucune sauvegarde pour le moment : la première sera faite à la prochaine modification.',
	'backups.daily': 'Quotidienne',
	'backups.beforeImport': 'Avant import',
	'backups.beforeRestore': 'Avant restauration',
	'backups.manual': 'Manuelle',
	'backups.made': 'Sauvegarde faite',
	'backups.failed': 'La sauvegarde a échoué',
	'backups.restored': { one: '{count} fichier restauré. La config précédente a été sauvegardée.', other: '{count} fichiers restaurés. La config précédente a été sauvegardée.' },
	'backups.restoreFailed': 'La restauration a échoué',
	'backups.files': { one: '{count} fichier', other: '{count} fichiers' },
	'backups.download': 'Télécharger',
	'backups.confirm': 'Confirmer la restauration',
	'backups.restore': 'Restaurer',
} satisfies Partial<Dict>;
