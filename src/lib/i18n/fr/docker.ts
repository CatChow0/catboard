import type { Dict } from '..';

export const docker = {
	'docker.memOf': '{used} sur {limit} ({pct} %)',
	'docker.cpuAll': 'CPU de tous les conteneurs démarrés (100 % = un cœur)',
	'docker.ramAll': 'Mémoire de tous les conteneurs démarrés',
	'docker.cpuOne': 'CPU (100 % = un cœur)',
	'docker.noEnv': 'Aucun environnement configuré',
} satisfies Partial<Dict>;
