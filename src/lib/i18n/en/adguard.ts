import type { Entry } from '..';

export const adguard = {
	'adguard.noData': 'No data',
	'adguard.queries': 'Queries',
	'adguard.blocked': 'Blocked',
	'adguard.domains': 'Domains',
	'adguard.latency': 'Latency',
	'adguard.removeStats': 'Remove AdGuard stats',
	'adguard.removeControl': 'Remove AdGuard control',
	'adguard.readonly': 'AdGuard {state} (only an admin can change it)',
	'adguard.stPaused': 'paused',
	'adguard.stActive': 'active',
	'adguard.stOff': 'off',
	'adguard.clickResume': 'AdGuard Paused - click to resume',
	'adguard.clickDisable': 'AdGuard Active - click to disable',
	'adguard.clickEnable': 'AdGuard Inactive - click to enable',
	'adguard.paused': 'Paused',
	'adguard.active': 'Active',
	'adguard.off': 'Off',
	'adguard.pauseFor': 'Pause for',
	'adguard.seconds': 'seconds',
	'adguard.custom': 'Custom',
} satisfies Record<string, Entry>;
