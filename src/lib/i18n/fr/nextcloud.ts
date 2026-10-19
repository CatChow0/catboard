import type { Dict } from '..';

export const nextcloud = {
	'nextcloud.quotaTitle': '{used} sur {total}',
	'nextcloud.usedNoQuota': '{used} utilisés, pas de quota',
	'nextcloud.ofTotal': 'sur {total}',
	'nextcloud.noQuota': 'pas de quota',
	'nextcloud.serverInfo': 'Les infos serveur demandent un admin Nextcloud et l\'application Monitoring.',
	'nextcloud.noFile': 'Aucun fichier pour le moment',
} satisfies Partial<Dict>;
