import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { locked } from '$lib/server/locked';
import { getUsers, setUsers } from '$lib/server/config';
import { hashPassword } from '$lib/auth/session';
import { apiError } from '$lib/server/api-error';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.isAuthenticated || !locals.role || (locals.role !== 'admin' && locals.role !== 'mini-admin')) {
		return apiError(403, 'errors.forbidden');
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

export const POST: RequestHandler = locked('users', async ({ locals, request }) => {
	if (!locals.isAuthenticated || locals.role !== 'admin') {
		return apiError(403, 'errors.forbidden');
	}

	const { username, password, role } = await request.json();
	if (!username || !password || password.length < 6) {
		return apiError(400, 'errors.credentialsMin');
	}

	const validRoles = ['admin', 'mini-admin', 'user'];
	if (!role || !validRoles.includes(role)) {
		return apiError(400, 'errors.invalidRole');
	}

	const usersConfig = await getUsers();
	if (usersConfig.users.find(u => u.username === username)) {
		return apiError(409, 'errors.userExists');
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
});