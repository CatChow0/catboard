import type { Entry } from '..';

export const deezer = {
	'deezer.type.album': 'Album',
	'deezer.type.ep': 'EP',
	'deezer.type.single': 'Single',
	'deezer.type.compile': 'Compilation',
} satisfies Record<string, Entry>;
