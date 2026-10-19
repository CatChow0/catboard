import type { Entry } from '..';

export const small = {
	'weather.noLocation': 'No location set',
	'weather.setLocation': 'Set location',
	'weather.remove': 'Remove weather',
	'weather.edit': 'Edit weather',
	'kuma.none': 'No status page configured',
	'clock.remove': 'Remove clock',
	'clock.edit': 'Edit clock',
	'proxmox.navLabel': '{name}: {running} of {total} guests running, CPU {cpu}%',
	'adguard.pausedShort': 'AdGuard Paused',
} satisfies Record<string, Entry>;
