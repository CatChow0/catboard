import { json, type RequestHandler } from '@sveltejs/kit';
import { findPrinter, clientFor } from '$lib/server/elegoo-cc2';

/** GET ?printer=<id> — preview image of the file being printed. */
export const GET: RequestHandler = async ({ url }) => {
	const printer = await findPrinter(url.searchParams.get('printer') || '');
	if (!printer) return json({ error: 'Printer not configured' }, { status: 404 });
	const thumb = clientFor(printer).thumb;
	if (!thumb) return json({ error: 'No thumbnail' }, { status: 404 });
	return new Response(new Uint8Array(thumb.data), {
		headers: { 'Content-Type': thumb.type, 'Cache-Control': 'private, max-age=3600' }
	});
};
