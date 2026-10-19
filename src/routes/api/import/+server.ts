import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setServices, setLayout, setSettingsForUser, setIntegrations, mutate, configDir } from '$lib/server/config';
import { createBackup, pruneBackups } from '$lib/server/backup';
import { apiError } from '$lib/server/api-error';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAuthenticated || !locals.username || locals.role !== 'admin') {
		return apiError(401, 'errors.unauthorized');
	}

	const body = await request.json();
	const sections: string[] = body.sections || [];
	const imported: string[] = [];
	// The current config can be restored from Settings > Export > Backups.
	if (sections.length) {
		await createBackup(configDir(), 'before-import');
		await pruneBackups(configDir());
	}

	for (const section of sections) {
		if (section === 'services' && body.services) {
			await mutate('services', () => setServices(body.services));
			imported.push('services');
		} else if (section === 'layout' && body.layout) {
			await mutate('layout', () => setLayout(body.layout));
			imported.push('layout');
		} else if (section === 'settings' && body.settings) {
			await setSettingsForUser(locals.username, body.settings);
			imported.push('settings');
		} else if (section === 'integrations' && body.integrations) {
			await mutate('integrations', () => setIntegrations(body.integrations));
			imported.push('integrations');
		}
	}

	return json({ ok: true, imported });
};