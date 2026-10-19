import type { Entry } from '..';

export const dashboard = {
	'dashboard.tilesCopied': { one: 'Tile copied to {target}', other: '{count} tiles copied to {target}' },
	'dashboard.tilesMoved': { one: 'Tile moved to {target}', other: '{count} tiles moved to {target}' },
	'dashboard.confirmDelete': 'Delete {count} tiles?',
	'dashboard.empty': 'This layout is empty',
	'dashboard.emptyHint': 'Add services and widgets with the + button for the {layout} layout',
	'dashboard.copyTo': 'Copy to',
	'dashboard.moveTo': 'Move to',
	'dashboard.deleteTiles': { one: 'Delete', other: 'Delete {count} tiles' },
	'dashboard.current': 'current',
	'dashboard.duplicate': 'duplicate',
	'dashboard.here': 'here',
	'dashboard.removeTile': 'Remove from dashboard',
	'dashboard.editService': 'Edit service',
} satisfies Record<string, Entry>;
