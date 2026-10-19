import type { Entry } from '..';

export const nextcloud = {
	'nextcloud.quotaTitle': '{used} of {total}',
	'nextcloud.usedNoQuota': '{used} used, no quota',
	'nextcloud.ofTotal': 'of {total}',
	'nextcloud.noQuota': 'no quota',
	'nextcloud.serverInfo': 'Server info needs a Nextcloud admin and the Monitoring app.',
	'nextcloud.noFile': 'No file yet',
} satisfies Record<string, Entry>;
