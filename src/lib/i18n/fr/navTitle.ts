import type { Dict } from '..';

export const navTitle = {
	'navTitle.confirmDelete': 'Supprimer le dashboard « {name} » avec ses tuiles et sa barre ? Action irréversible.',
	'navTitle.default': 'Dashboard',
	'navTitle.dashboards': 'Dashboards',
	'navTitle.dashboard': 'Dashboard {name}',
	'navTitle.manageSuffix': ' (gérer)',
	'navTitle.manageTitle': '{name} : clique pour renommer, déplacer ou supprimer',
	'navTitle.new': 'Nouveau dashboard',
	'navTitle.newName': 'Dashboard {n}',
	'navTitle.manage': 'Gérer le dashboard {name}',
	'navTitle.moveLeft': '← Déplacer',
	'navTitle.moveRight': 'Déplacer →',
	'navTitle.lastOne': 'Le dernier dashboard ne peut pas être supprimé',
	'navTitle.delete': 'Supprimer le dashboard',
} satisfies Partial<Dict>;
