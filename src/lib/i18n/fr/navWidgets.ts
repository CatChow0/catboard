import type { Dict } from '..';

export const navWidgets = {
	'navw.containers': '{label}, afficher les conteneurs',
	'navw.print': '{label}, afficher le détail de l\'impression',
	'navw.builds': '{label}, afficher les derniers builds',
	'navw.guests': '{label}, afficher les invités',
	'navw.monitors': '{label}, afficher les sondes',
	'proxmox.nodeTitle': '{node} : {status}, en ligne depuis {uptime}',
	'proxmox.st.online': 'en ligne',
	'proxmox.st.offline': 'hors ligne',
} satisfies Partial<Dict>;
