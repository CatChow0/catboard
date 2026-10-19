import type { Entry } from '..';

export const service = {
	'service.editTitle': 'Edit Service',
	'service.addTitle': 'Add Service',
	'service.name': 'Name',
	'service.url': 'URL',
	'service.icon': 'Icon',
	'service.description': 'Description',
	'service.statusCheck': 'Enable status check',
	'service.placeholderDesc': 'Hypervisor',
} satisfies Record<string, Entry>;
