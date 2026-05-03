import type { RequestHandler } from './$types';
import { getAvailableDisks } from '$lib/server/system-stats';

export const GET: RequestHandler = async () => {
	const disks = await getAvailableDisks();
	return new Response(JSON.stringify({ disks }), {
		headers: { 'Content-Type': 'application/json' }
	});
};