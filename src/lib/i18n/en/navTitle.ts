import type { Entry } from '..';

export const navTitle = {
	'navTitle.confirmDelete': 'Delete the dashboard "{name}" with its tiles and navbar? This cannot be undone.',
	'navTitle.default': 'Dashboard',
	'navTitle.dashboards': 'Dashboards',
	'navTitle.dashboard': 'Dashboard {name}',
	'navTitle.manageSuffix': ' (manage)',
	'navTitle.manageTitle': '{name}: click to rename, move or delete',
	'navTitle.new': 'New dashboard',
	'navTitle.newName': 'Dashboard {n}',
	'navTitle.manage': 'Manage dashboard {name}',
	'navTitle.moveLeft': '← Move',
	'navTitle.moveRight': 'Move →',
	'navTitle.lastOne': 'The last dashboard cannot be deleted',
	'navTitle.delete': 'Delete dashboard',
} satisfies Record<string, Entry>;
