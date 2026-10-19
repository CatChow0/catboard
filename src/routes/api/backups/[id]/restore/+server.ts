import { json, type RequestHandler } from '@sveltejs/kit';
import { configDir, mutate } from '$lib/server/config';
import { restoreBackup } from '$lib/server/backup';

/** POST — put a backup back; the current config is backed up first (admin). */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (locals.role !== 'admin') return json({ error: 'Only the admin can manage backups' }, { status: 403 });
	try {
		// No other change to the config while files are being replaced.
		const restored = await mutate('services', () => mutate('layout', () => mutate('integrations', () => mutate('users', () => restoreBackup(configDir(), params.id ?? '')))));
		return json({ ok: true, restored });
	} catch (err) {
		const unknown = err instanceof Error && err.message === 'Unknown backup';
		return json({ error: unknown ? 'Unknown backup' : 'Restore failed' }, { status: unknown ? 404 : 500 });
	}
};
