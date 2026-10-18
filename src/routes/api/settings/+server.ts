import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSettingsForUser, setSettingsForUser } from '$lib/server/config';
import { MAX_CUSTOM_CSS } from '$lib/themes';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.isAuthenticated || !locals.username) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const data = await getSettingsForUser(locals.username);
	return json(data);
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.isAuthenticated || !locals.username) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	if (typeof body.customCss === 'string') body.customCss = body.customCss.slice(0, MAX_CUSTOM_CSS);
	await setSettingsForUser(locals.username, body);
	return json(body);
};