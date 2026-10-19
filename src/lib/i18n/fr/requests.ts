import type { Dict } from '..';

export const requests = {
	'requests.pending': 'En attente',
	'requests.approved': 'Acceptée',
	'requests.declined': 'Refusée',
	'requests.processing': 'En cours',
	'requests.available': 'Disponible',
	'requests.failed': 'Échec',
	'requests.approve': 'Accepter',
	'requests.decline': 'Refuser',
	'requests.approveNamed': 'Accepter {title}',
	'requests.declineNamed': 'Refuser {title}',
} satisfies Partial<Dict>;
