import type { Entry } from '..';

export const counts = {
	'count.running': '{n} running',
	'count.stopped': '{n} stopped',
	'count.up': '{n} up',
	'count.down': '{n} down',
	'count.empty': '{n} empty',
	'count.low': '{n} low',
	'count.available': '{n} available',
	'nextcloud.used': '{value} used',
	'nextcloud.activeToday': '{n} active today',
	'nextcloud.files': '{n} files',
	'nextcloud.free': '{value} free',
	'proxmox.runningTitle': '{running} of {total} guests running',
	'proxmox.runningShort': '{running}/{total} running',
	'adguard.navTitle': '{blocked} blocked / {total} queries',
	'adguard.pctBlocked': '{pct}% blocked',
	'printer.nameOffline': '{name} · offline',
} satisfies Record<string, Entry>;
