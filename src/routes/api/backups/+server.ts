import { json, type RequestHandler } from '@sveltejs/kit';
import { configDir } from '$lib/server/config';
import { createBackup, listBackups, pruneBackups } from '$lib/server/backup';

const denied = () => json({ error: 'Only the admin can manage backups' }, { status: 403 });

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
