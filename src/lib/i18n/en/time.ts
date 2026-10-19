import type { Entry } from '..';

export const time = {
	'time.minAgo': '{n} min ago',
	'time.hAgo': '{n} h ago',
	'time.dAgo': '{n} d ago',
	'time.today': 'Today',
	'time.yesterday': 'Yesterday',
	'time.daysAgo': '{n} days ago',
	'time.justNow': 'just now',
	'time.days': '{d}d {h}h',
} satisfies Record<string, Entry>;
