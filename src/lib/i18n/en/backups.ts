import type { Entry } from '..';

export const backups = {
	'backups.title': 'Backups',
	'backups.now': 'Back up now',
	'backups.hint': 'A copy of the configuration (services, layout, integrations, users, settings) is made each day before the first change, and before every import or restore. The 14 latest daily backups are kept.',
	'backups.none': 'No backup yet: the first one is made at the next change.',
	'backups.daily': 'Daily',
	'backups.beforeImport': 'Before import',
	'backups.beforeRestore': 'Before restore',
	'backups.manual': 'Manual',
	'backups.made': 'Backup made',
	'backups.failed': 'Backup failed',
	'backups.restored': { one: 'Restored {count} file. The previous config was backed up.', other: 'Restored {count} files. The previous config was backed up.' },
	'backups.restoreFailed': 'Restore failed',
	'backups.files': { one: '{count} file', other: '{count} files' },
	'backups.download': 'Download',
	'backups.confirm': 'Confirm restore',
	'backups.restore': 'Restore',
} satisfies Record<string, Entry>;
