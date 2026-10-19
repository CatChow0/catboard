import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { locked } from '$lib/server/locked';
import { getUsers, setUsers, findUserByUsername } from '$lib/server/config';
import { hashPassword } from '$lib/auth/session';
import { apiError } from '$lib/server/api-error';

export const PUT: RequestHandler = locked('users', async ({ locals, params, request }) => {
	if (!locals.isAuthenticated || !locals.role) {
		return apiError(403, 'errors.forbidden');
	}

	const { username } = params;
	const target = await findUserByUsername(username);
	if (!target) {
		return apiError(404, 'errors.userNotFound');
	}

	// Only admin can modify admin/mini-admin accounts
	if (target.role === 'admin' || target.role === 'mini-admin') {
		if (locals.role !== 'admin') {
			return apiError(403, 'errors.forbidden');
		}
	}

	// Cannot modify main admin's role
	if (target.isMainAdmin) {
		const body = await request.json();
		if (body.role && body.role !== target.role) {
			return apiError(403, 'errors.mainAdminRole');
		}
	}

	// mini-admin can only modify regular users
	if (locals.role === 'mini-admin' && target.role !== 'user') {
		return apiError(403, 'errors.forbidden');
	}

	const body = await request.json();
	const usersConfig = await getUsers();
	const user = usersConfig.users.find(u => u.username === username);
	if (!user) {
		return apiError(404, 'errors.userNotFound');
	}

	if (body.role && ['admin', 'mini-admin', 'user'].includes(body.role)) {
		if (user.isMainAdmin && body.role !== user.role) {
			return apiError(403, 'errors.mainAdminRole');
		}
		user.role = body.role;
	}

	if (body.password && body.password.length >= 6) {
		user.passwordHash = hashPassword(body.password);
	}

	await setUsers(usersConfig);
	return json({ success: true, user: { username: user.username, role: user.role, isMainAdmin: user.isMainAdmin } });
});

export const DELETE: RequestHandler = locked('users', async ({ locals, params }) => {
	if (!locals.isAuthenticated || locals.role !== 'admin') {
		return apiError(403, 'errors.forbidden');
	}

	const { username } = params;
	const usersConfig = await getUsers();
	const user = usersConfig.users.find(u => u.username === username);

	if (!user) {
		return apiError(404, 'errors.userNotFound');
	}

	if (user.isMainAdmin) {
		return apiError(403, 'errors.mainAdminDelete');
	}

	if (username === locals.username) {
		return apiError(403, 'errors.ownAccount');
	}

	usersConfig.users = usersConfig.users.filter(u => u.username !== username);
	await setUsers(usersConfig);
	return json({ success: true });
});