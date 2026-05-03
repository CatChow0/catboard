import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { destroySession, getDeleteCookieHeader } from '$lib/auth/session';

export const POST: RequestHandler = async ({ cookies }) => {
	const sid = cookies.get('sid');
	if (sid) await destroySession(sid);

	return json({ success: true }, {
		status: 200,
		headers: { 'Set-Cookie': getDeleteCookieHeader() }
	});
};