import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getUsers } from '$lib/server/config';
import { verifyPassword, createSession, getSessionCookieHeader } from '$lib/auth/session';

export const POST: RequestHandler = async ({ request }) => {
	const { username, password } = await request.json();
	if (!username || !password) {
		return json({ error: 'Username and password required' }, { status: 400 });
	}

	const usersConfig = await getUsers();
	const user = usersConfig.users.find(u => u.username === username);
	if (!user || !verifyPassword(password, user.passwordHash)) {
		return json({ error: 'Invalid credentials' }, { status: 401 });
	}

	const sessionId = await createSession(username);
	return json({ success: true, username: user.username, role: user.role }, {
		status: 200,
		headers: { 'Set-Cookie': getSessionCookieHeader(sessionId) }
	});
};