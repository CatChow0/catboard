import type { Entry } from '..';

export const disk = {
	'disk.pages': 'Disks, page {page} of {total}: next page',
	'disk.disks': 'Disks',
	'disk.disk': 'Disk',
	'disk.noData': 'No data',
} satisfies Record<string, Entry>;
