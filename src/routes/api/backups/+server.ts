import { json, type RequestHandler } from '@sveltejs/kit';
import { configDir } from '$lib/server/config';
import { createBackup, listBackups, pruneBackups } from '$lib/server/backup';
import { apiError } from '$lib/server/api-error';

const denied = () => apiError(403, 'errors.adminBackups');

/** GET — the config backups, newest first (admin). */
export const GET: RequestHandler = async ({ locals }) => {
	if (locals.role !== 'admin') return denied();
	return json({ backups: await listBackups(configDir()) });
};

/** POST — make a backup now (admin). */
export const POST: RequestHandler = async ({ locals }) => {
	if (locals.role !== 'admin') return denied();
	const backup = await createBackup(configDir(), 'manual');
	await pruneBackups(configDir());
	return json(backup, { status: 201 });
};
