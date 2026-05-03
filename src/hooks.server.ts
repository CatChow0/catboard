import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/auth/session';
import { isSetupDone, findUserByUsername, migrateAuthToUsers } from '$lib/server/config';

export const handle: Handle = async ({ event, resolve }) => {
	// Run migration once
	await migrateAuthToUsers();

	const sid = event.cookies.get('sid');

	event.locals.username = null;
	event.locals.role = null;

	if (sid) {
		const username = await validateSession(sid);
		if (username) {
			event.locals.isAuthenticated = true;
			event.locals.username = username;
			const user = await findUserByUsername(username);
			event.locals.role = user?.role ?? null;
		} else {
			event.cookies.delete('sid', { path: '/' });
			event.locals.isAuthenticated = false;
		}
	} else {
		event.locals.isAuthenticated = false;
	}

	// Check if setup is needed
	const setupDone = await isSetupDone();
	const isSetupRoute = event.url.pathname.startsWith('/api/auth/setup');
	const isLoginRoute = event.url.pathname === '/login' || event.url.pathname.startsWith('/api/auth/login');

	if (!setupDone && !isSetupRoute) {
		if (event.url.pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ needsSetup: true }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		if (event.url.pathname !== '/login') {
			return new Response(null, {
				status: 302,
				headers: { Location: '/login' }
			});
		}
	}

	// If authenticated or on public routes, continue
	if (event.locals.isAuthenticated || isLoginRoute || isSetupRoute || event.url.pathname === '/api/auth/check') {
		return resolve(event);
	}

	// Not authenticated
	if (event.url.pathname.startsWith('/api/')) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(null, {
		status: 302,
		headers: { Location: '/login' }
	});
};