import { json, type RequestHandler } from '@sveltejs/kit';
import { findPrinter, clientFor, toStatus } from '$lib/server/elegoo-cc2';

/** GET ?printer=<id> — current print status (opens the shared printer connection if needed). */
export const GET: RequestHandler = async ({ url }) => {
	const printer = await findPrinter(url.searchParams.get('printer') || '');
	if (!printer) return json({ error: 'Printer not configured' }, { status: 404 });
	const client = clientFor(printer);
	// First request: give the connection a moment to deliver a full status.
	await client.ready(4000);
	return json(toStatus(client), { headers: { 'Cache-Control': 'no-store' } });
};
