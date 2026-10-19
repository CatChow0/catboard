import type { Dict } from '..';

export const small = {
	'weather.noLocation': 'Aucun lieu défini',
	'weather.setLocation': 'Choisir un lieu',
	'weather.remove': 'Retirer la météo',
	'weather.edit': 'Modifier la météo',
	'kuma.none': 'Aucune page de statut configurée',
	'clock.remove': 'Retirer l\'horloge',
	'clock.edit': 'Modifier l\'horloge',
	'proxmox.navLabel': '{name} : {running} invités démarrés sur {total}, CPU {cpu} %',
	'adguard.pausedShort': 'AdGuard en pause',
} satisfies Partial<Dict>;
