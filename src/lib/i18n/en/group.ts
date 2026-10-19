import type { Entry } from '..';

export const group = {
	'group.scrollsV': 'Scrolls vertically',
	'group.scrollsH': 'Scrolls horizontally',
	'group.remove': 'Remove group',
	'group.edit': 'Edit group',
	'group.editTitle': 'Edit Group',
	'group.title': 'Title',
	'group.namePlaceholder': 'Group name',
	'group.content': 'Content',
	'group.fixed': 'Fixed size (fits the group)',
	'group.scrollV': 'Scroll vertically (more rows)',
	'group.scrollH': 'Scroll horizontally (more columns)',
	'group.scrollHint': 'Cells keep their size; drop tiles past the edge to extend the group\'s content. Scroll with the wheel or by swiping.',
	'group.outline': 'Outline color',
	'group.clearColor': 'Clear color',
	'group.compact': 'Compact mode (no header)',
} satisfies Record<string, Entry>;
