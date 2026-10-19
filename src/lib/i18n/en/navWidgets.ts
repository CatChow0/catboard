import type { Entry } from '..';

export const navWidgets = {
	'navw.containers': '{label}, show containers',
	'navw.print': '{label}, show print details',
	'navw.builds': '{label}, show the latest builds',
	'navw.guests': '{label}, show the guests',
	'navw.monitors': '{label}, show monitors',
	'proxmox.nodeTitle': '{node}: {status}, up {uptime}',
	'proxmox.st.online': 'online',
	'proxmox.st.offline': 'offline',
} satisfies Record<string, Entry>;
