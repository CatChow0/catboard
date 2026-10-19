import type { Entry } from '..';

export const cache = {
	'cache.title': 'Icon Cache',
	'cache.desc': 'Service icons (selfh.st and homarr libraries, custom URLs, favicons) are downloaded once by CatBoard and served from its cache. Icons that could not be found are retried after a day. Clearing keeps uploaded images; rebuilding clears and fetches the icons of every service again.',
	'cache.cached': 'Cached icons',
	'cache.uploaded': 'Uploaded',
	'cache.misses': 'Not found (retried tomorrow)',
	'cache.size': 'Total size',
	'cache.rebuilt': { one: 'Rebuilt {count} icon', other: 'Rebuilt {count} icons' },
	'cache.failedList': '{count} failed: {list}',
	'cache.rebuilding': 'Rebuilding...',
	'cache.rebuild': 'Rebuild Icon Cache',
	'cache.clearing': 'Clearing...',
	'cache.clear': 'Clear Icon Cache',
} satisfies Record<string, Entry>;
