import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { destroySession, getDeleteCookieHeader, isSecureRequest } from '$lib/auth/session';

export const POST: RequestHandler = async ({ cookies, url, request }) => {
	const sid = cookies.get('sid');
	if (sid) await destroySession(sid);

	return json({ success: true }, {
		status: 200,
		headers: { 'Set-Cookie': getDeleteCookieHeader(isSecureRequest(url, request.headers)) }
	});
};