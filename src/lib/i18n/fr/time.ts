import type { Dict } from '..';

export const time = {
	'time.minAgo': 'il y a {n} min',
	'time.hAgo': 'il y a {n} h',
	'time.dAgo': 'il y a {n} j',
	'time.today': 'Aujourd\'hui',
	'time.yesterday': 'Hier',
	'time.daysAgo': 'il y a {n} jours',
	'time.justNow': 'à l\'instant',
	'time.days': '{d} j {h} h',
} satisfies Partial<Dict>;
