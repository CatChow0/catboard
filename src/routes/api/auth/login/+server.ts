import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getUsers } from '$lib/server/config';
import { verifyPassword, createSession, getSessionCookieHeader, isSecureRequest } from '$lib/auth/session';
import { loginLimiter, addressLimiter } from '$lib/server/rate-limit';
import { apiError } from '$lib/server/api-error';
import { translate } from '$lib/i18n';

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	const { username, password } = await request.json();
	if (!username || !password) {
		return apiError(400, 'errors.credentialsRequired');
	}

	// Repeated failures slow down guessing, per account and per client address.
	const userKey = String(username).toLowerCase();
	let address = '';
	try {
		address = getClientAddress();
	} catch {
		// no address (tests, unusual adapters): the account limit still applies
	}
	const blocked = [loginLimiter.check(userKey), address ? addressLimiter.check(address) : { blocked: false, retryAfter: 0 }].find((c) => c.blocked);
	if (blocked) {
		return json(
			{ error: translate('en', 'errors.tooManyAttempts', { seconds: blocked.retryAfter }), code: 'errors.tooManyAttempts', params: { seconds: blocked.retryAfter }, retryAfter: blocked.retryAfter },
			{ status: 429, headers: { 'Retry-After': String(blocked.retryAfter) } }
		);
	}

	const usersConfig = await getUsers();
	const user = usersConfig.users.find(u => u.username === username);
	if (!user || !verifyPassword(password, user.passwordHash)) {
		loginLimiter.fail(userKey);
		if (address) addressLimiter.fail(address);
		if (loginLimiter.check(userKey).blocked || (address && addressLimiter.check(address).blocked)) {
			console.warn(`[auth] login blocked after repeated failures: user "${userKey}", address ${address || 'unknown'}`);
		}
		return apiError(401, 'errors.invalidCredentials');
	}

	loginLimiter.reset(userKey);
	const sessionId = await createSession(username);
	return json({ success: true, username: user.username, role: user.role }, {
		status: 200,
		headers: { 'Set-Cookie': getSessionCookieHeader(sessionId, isSecureRequest(url, request.headers)) }
	});
};
