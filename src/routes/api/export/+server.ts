import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServices, getLayout, getSettingsForUser, getIntegrations } from '$lib/server/config';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.isAuthenticated || !locals.username || !locals.role || (locals.role !== 'admin' && locals.role !== 'mini-admin')) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const [services, layout, settings, integrations] = await Promise.all([
		getServices(),
		getLayout(),
		getSettingsForUser(locals.username),
		getIntegrations()
	]);

	return json({
		version: 1,
		exportedAt: new Date().toISOString(),
		services,
		layout,
		settings,
		integrations
	});
};