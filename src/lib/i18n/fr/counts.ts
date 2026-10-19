import type { Dict } from '..';

export const counts = {
	'count.running': '{n} démarrés',
	'count.stopped': '{n} arrêtés',
	'count.up': '{n} en ligne',
	'count.down': '{n} hors ligne',
	'count.empty': '{n} vides',
	'count.low': '{n} basses',
	'count.available': '{n} disponibles',
	'nextcloud.used': '{value} utilisés',
	'nextcloud.activeToday': '{n} actifs aujourd\'hui',
	'nextcloud.files': '{n} fichiers',
	'nextcloud.free': '{value} libres',
	'proxmox.runningTitle': '{running} invités démarrés sur {total}',
	'proxmox.runningShort': '{running}/{total} démarrés',
	'adguard.navTitle': '{blocked} bloquées / {total} requêtes',
	'adguard.pctBlocked': '{pct} % bloquées',
	'printer.nameOffline': '{name} · hors ligne',
} satisfies Partial<Dict>;
