import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setServices, setLayout, setSettingsForUser, setIntegrations } from '$lib/server/config';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAuthenticated || !locals.username || locals.role !== 'admin') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const sections: string[] = body.sections || [];
	const imported: string[] = [];

	for (const section of sections) {
		if (section === 'services' && body.services) {
			await setServices(body.services);
			imported.push('services');
		} else if (section === 'layout' && body.layout) {
			await setLayout(body.layout);
			imported.push('layout');
		} else if (section === 'settings' && body.settings) {
			await setSettingsForUser(locals.username, body.settings);
			imported.push('settings');
		} else if (section === 'integrations' && body.integrations) {
			await setIntegrations(body.integrations);
			imported.push('integrations');
		}
	}

	return json({ ok: true, imported });
};