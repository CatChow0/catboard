import type { Entry } from '..';

export const spoolman = {
	'spoolman.noColour': 'No colour',
	'spoolman.empty': 'Empty',
	'spoolman.low': 'Low',
	'spoolman.spools': 'Spools',
	'spoolman.noneLeft': 'No spool with filament left',
	'spoolman.recent': 'Recently used',
	'spoolman.noneUsed': 'No spool used yet',
	'spoolman.lowEmpty': 'Running low / empty',
	'spoolman.allGood': 'All spools have enough filament',
} satisfies Record<string, Entry>;
