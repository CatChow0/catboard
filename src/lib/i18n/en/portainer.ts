import type { Entry } from '..';

export const portainer = {
	'portainer.starting': 'Starting {name}…',
	'portainer.stopping': 'Stopping {name}…',
	'portainer.started': '{name} started',
	'portainer.stopped': '{name} stopped',
	'portainer.running': 'Running containers',
	'portainer.stoppedContainers': 'Stopped containers',
	'portainer.unhealthy': 'Unhealthy containers',
	'portainer.down': 'down',
	'portainer.stop': 'Stop {name}',
	'portainer.start': 'Start {name}',
	'portainer.noStack': 'No stack',
	'portainer.confirmTitle': 'Stop {name}?',
	'portainer.stopLabel': 'Stop',
	'portainer.confirmText': 'Stops every container of the stack {name} on {env}. Start it again from here or from Portainer.',
} satisfies Record<string, Entry>;
