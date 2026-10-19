import { json, type RequestHandler } from '@sveltejs/kit';
import { configDir } from '$lib/server/config';
import { backupBundle } from '$lib/server/backup';

/** GET — one backup as a JSON file to download (admin). */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (locals.role !== 'admin') return json({ error: 'Only the admin can manage backups' }, { status: 403 });
	try {
		const bundle = await backupBundle(configDir(), params.id ?? '');
		return json(bundle, { headers: { 'Content-Disposition': `attachment; filename="catboard-backup-${bundle.id}.json"` } });
	} catch {
		return json({ error: 'Unknown backup' }, { status: 404 });
	}
};
