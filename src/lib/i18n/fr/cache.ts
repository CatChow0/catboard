import type { Dict } from '..';

export const cache = {
	'cache.title': 'Cache d\'icônes',
	'cache.desc': 'Les icônes des services (bibliothèques selfh.st et homarr, URL personnalisées, favicons) sont téléchargées une fois par CatBoard puis servies depuis son cache. Les icônes introuvables sont recherchées à nouveau au bout d\'un jour. Vider le cache garde les images envoyées ; le reconstruire le vide puis récupère à nouveau les icônes de tous les services.',
	'cache.cached': 'Icônes en cache',
	'cache.uploaded': 'Envoyées',
	'cache.misses': 'Introuvables (réessai demain)',
	'cache.size': 'Taille totale',
	'cache.rebuilt': { one: '{count} icône reconstruite', other: '{count} icônes reconstruites' },
	'cache.failedList': '{count} en échec : {list}',
	'cache.rebuilding': 'Reconstruction...',
	'cache.rebuild': 'Reconstruire le cache',
	'cache.clearing': 'Vidage...',
	'cache.clear': 'Vider le cache',
} satisfies Partial<Dict>;
