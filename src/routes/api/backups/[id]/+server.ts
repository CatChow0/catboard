import { json, type RequestHandler } from '@sveltejs/kit';
import { configDir } from '$lib/server/config';
import { backupBundle } from '$lib/server/backup';
import { apiError } from '$lib/server/api-error';

/** GET — one backup as a JSON file to download (admin). */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (locals.role !== 'admin') return apiError(403, 'errors.adminBackups');
	try {
		const bundle = await backupBundle(configDir(), params.id ?? '');
		return json(bundle, { headers: { 'Content-Disposition': `attachment; filename="catboard-backup-${bundle.id}.json"` } });
	} catch {
		return apiError(404, 'errors.unknownBackup');
	}
};
