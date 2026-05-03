import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getUsers, setUsers, findUserByUsername } from '$lib/server/config';
import { hashPassword } from '$lib/auth/session';

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.isAuthenticated || !locals.role) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const { username } = params;
	const target = await findUserByUsername(username);
	if (!target) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	// Only admin can modify admin/mini-admin accounts
	if (target.role === 'admin' || target.role === 'mini-admin') {
		if (locals.role !== 'admin') {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
	}

	// Cannot modify main admin's role
	if (target.isMainAdmin) {
		const body = await request.json();
		if (body.role && body.role !== target.role) {
			return json({ error: 'Cannot change main admin role' }, { status: 403 });
		}
	}

	// mini-admin can only modify regular users
	if (locals.role === 'mini-admin' && target.role !== 'user') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await request.json();
	const usersConfig = await getUsers();
	const user = usersConfig.users.find(u => u.username === username);
	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	if (body.role && ['admin', 'mini-admin', 'user'].includes(body.role)) {
		if (user.isMainAdmin && body.role !== user.role) {
			return json({ error: 'Cannot change main admin role' }, { status: 403 });
		}
		user.role = body.role;
	}

	if (body.password && body.password.length >= 6) {
		user.passwordHash = hashPassword(body.password);
	}

	await setUsers(usersConfig);
	return json({ success: true, user: { username: user.username, role: user.role, isMainAdmin: user.isMainAdmin } });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.isAuthenticated || locals.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const { username } = params;
	const usersConfig = await getUsers();
	const user = usersConfig.users.find(u => u.username === username);

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	if (user.isMainAdmin) {
		return json({ error: 'Cannot delete main admin account' }, { status: 403 });
	}

	if (username === locals.username) {
		return json({ error: 'Cannot delete your own account' }, { status: 403 });
	}

	usersConfig.users = usersConfig.users.filter(u => u.username !== username);
	await setUsers(usersConfig);
	return json({ success: true });
};