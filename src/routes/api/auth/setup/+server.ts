import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isSetupDone, setUsers } from '$lib/server/config';
import { hashPassword } from '$lib/auth/session';

export const POST: RequestHandler = async ({ request }) => {
	const setupDone = await isSetupDone();
	if (setupDone) {
		return json({ error: 'Setup already completed' }, { status: 400 });
	}

	const { username, password } = await request.json();
	if (!username || !password || password.length < 6) {
		return json({ error: 'Username and password (min 6 chars) required' }, { status: 400 });
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

	return json({ success: true });
};