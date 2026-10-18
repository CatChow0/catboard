import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServices, getSettingsForUser } from '$lib/server/config';
import { checkAll, statusCache, statusTtl } from '$lib/server/status';

// Shared by every viewer, kept for the reader's check interval (see server/status.ts).
const statuses = statusCache(async () => checkAll((await getServices()).services));

export const GET: RequestHandler = async ({ locals }) => {
	const interval = locals.username ? (await getSettingsForUser(locals.username)).statusCheckInterval : undefined;
	return json(await statuses(statusTtl(interval)));
};
