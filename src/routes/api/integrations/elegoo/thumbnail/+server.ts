import { json, type RequestHandler } from '@sveltejs/kit';
import { findPrinter, clientFor } from '$lib/server/elegoo-cc2';
import { apiError } from '$lib/server/api-error';

/** GET ?printer=<id> — preview image of the file being printed. */
export const GET: RequestHandler = async ({ url }) => {
	const printer = await findPrinter(url.searchParams.get('printer') || '');
	if (!printer) return apiError(404, 'errors.printerNotConfigured');
	const thumb = clientFor(printer).thumb;
	if (!thumb) return apiError(404, 'errors.noThumbnail');
	return new Response(new Uint8Array(thumb.data), {
		headers: { 'Content-Type': thumb.type, 'Cache-Control': 'private, max-age=3600' }
	});
};
