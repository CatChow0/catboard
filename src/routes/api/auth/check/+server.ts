import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isSetupDone } from '$lib/server/config';

export const GET: RequestHandler = async ({ locals }) => {
	const setupDone = await isSetupDone();
	return json({
		authenticated: locals.isAuthenticated,
		needsSetup: !setupDone,
		username: locals.username,
		role: locals.role
	});
};