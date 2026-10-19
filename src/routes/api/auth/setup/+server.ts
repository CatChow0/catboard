import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isSetupDone, setUsers, setAccess } from '$lib/server/config';
import { hashPassword } from '$lib/auth/session';
import { apiError } from '$lib/server/api-error';

export const POST: RequestHandler = async ({ request }) => {
	const setupDone = await isSetupDone();
	if (setupDone) {
		return apiError(400, 'errors.setupDone');
	}

	const { username, password } = await request.json();
	if (!username || !password || password.length < 6) {
		return apiError(400, 'errors.credentialsMin');
	}

	const passwordHash = hashPassword(password);
	await setUsers({
		users: [{
			username,
			passwordHash,
			role: 'admin',
			isMainAdmin: true
		}]
	});
	// New installs: only admins change the dashboards (Settings > Admin to open it up).
	await setAccess({ dashboardEditors: 'admins' });

	return json({ success: true });
};