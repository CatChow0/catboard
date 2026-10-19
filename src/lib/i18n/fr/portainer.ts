import type { Dict } from '..';

export const portainer = {
	'portainer.starting': 'Démarrage de {name}…',
	'portainer.stopping': 'Arrêt de {name}…',
	'portainer.started': '{name} démarré',
	'portainer.stopped': '{name} arrêté',
	'portainer.running': 'Conteneurs démarrés',
	'portainer.stoppedContainers': 'Conteneurs arrêtés',
	'portainer.unhealthy': 'Conteneurs en mauvaise santé',
	'portainer.down': 'injoignable',
	'portainer.stop': 'Arrêter {name}',
	'portainer.start': 'Démarrer {name}',
	'portainer.noStack': 'Aucune stack',
	'portainer.confirmTitle': 'Arrêter {name} ?',
	'portainer.stopLabel': 'Arrêter',
	'portainer.confirmText': 'Arrête tous les conteneurs de la stack {name} sur {env}. Tu peux la redémarrer d\'ici ou depuis Portainer.',
} satisfies Partial<Dict>;
