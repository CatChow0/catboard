import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getUsers, setUsers } from '$lib/server/config';
import { hashPassword } from '$lib/auth/session';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.isAuthenticated || !locals.role || (locals.role !== 'admin' && locals.role !== 'mini-admin')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const usersConfig = await getUsers();
	return json({
		users: usersConfig.users.map(u => ({
			username: u.username,
			role: u.role,
			isMainAdmin: u.isMainAdmin
		}))
	});
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.isAuthenticated || locals.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const { username, password, role } = await request.json();
	if (!username || !password || password.length < 6) {
		return json({ error: 'Username and password (min 6 chars) required' }, { status: 400 });
	}

	const validRoles = ['admin', 'mini-admin', 'user'];
	if (!role || !validRoles.includes(role)) {
		return json({ error: 'Invalid role' }, { status: 400 });
	}

	const usersConfig = await getUsers();
	if (usersConfig.users.find(u => u.username === username)) {
		return json({ error: 'Username already exists' }, { status: 409 });
	}

	const passwordHash = hashPassword(password);
	usersConfig.users.push({
		username,
		passwordHash,
		role,
		isMainAdmin: false
	});

	await setUsers(usersConfig);
	return json({ success: true, user: { username, role, isMainAdmin: false } }, { status: 201 });
};