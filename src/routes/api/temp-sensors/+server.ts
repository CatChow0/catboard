import type { RequestHandler } from './$types';
import { getAvailableTempSensors } from '$lib/server/system-stats';

export const GET: RequestHandler = async () => {
	const sensors = await getAvailableTempSensors();
	return new Response(JSON.stringify({ sensors }), {
		headers: { 'Content-Type': 'application/json' }
	});
};