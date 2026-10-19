import type { Entry } from '..';

export const docker = {
	'docker.memOf': '{used} of {limit} ({pct}%)',
	'docker.cpuAll': 'CPU of all running containers (100% = one core)',
	'docker.ramAll': 'Memory of all running containers',
	'docker.cpuOne': 'CPU (100% = one core)',
	'docker.noEnv': 'No environment configured',
} satisfies Record<string, Entry>;
