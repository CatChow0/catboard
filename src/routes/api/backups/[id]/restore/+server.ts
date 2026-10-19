import { json, type RequestHandler } from '@sveltejs/kit';
import { configDir, mutate } from '$lib/server/config';
import { restoreBackup } from '$lib/server/backup';
import { apiError } from '$lib/server/api-error';

/** POST — put a backup back; the current config is backed up first (admin). */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (locals.role !== 'admin') return apiError(403, 'errors.adminBackups');
	try {
		// No other change to the config while files are being replaced.
		const restored = await mutate('services', () => mutate('layout', () => mutate('integrations', () => mutate('users', () => restoreBackup(configDir(), params.id ?? '')))));
		return json({ ok: true, restored });
	} catch (err) {
		const unknown = err instanceof Error && err.message === 'Unknown backup';
		return unknown ? apiError(404, 'errors.unknownBackup') : apiError(500, 'errors.restoreFailed');
	}
};
