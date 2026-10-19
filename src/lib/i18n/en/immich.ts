import type { Entry } from '..';

export const immich = {
	'immich.mine': 'my library',
	'immich.photos': 'photos',
	'immich.videos': 'videos',
	'immich.storage': 'storage',
	'immich.noPhoto': 'No photo yet',
} satisfies Record<string, Entry>;
