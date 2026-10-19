import type { Entry } from '..';

export const requests = {
	'requests.pending': 'Pending',
	'requests.approved': 'Approved',
	'requests.declined': 'Declined',
	'requests.processing': 'Processing',
	'requests.available': 'Available',
	'requests.failed': 'Failed',
	'requests.approve': 'Approve',
	'requests.decline': 'Decline',
	'requests.approveNamed': 'Approve {title}',
	'requests.declineNamed': 'Decline {title}',
} satisfies Record<string, Entry>;
