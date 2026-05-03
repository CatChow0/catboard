import type { RequestHandler } from './$types';
import { getCachedIcon, fetchAndCacheIcon, readIconFile } from '$lib/server/icon-cache';

export const GET: RequestHandler = async ({ url }) => {
	const serviceUrl = url.searchParams.get('url');
	if (!serviceUrl) {
		return new Response('Missing url parameter', { status: 400 });
	}

	// Check cache first
	let entry = await getCachedIcon(serviceUrl);

	// If not cached, fetch and cache
	if (!entry) {
		entry = await fetchAndCacheIcon(serviceUrl);
	}

	if (!entry) {
		return new Response('Not found', { status: 404 });
	}

	const data = await readIconFile(entry.filename);
	if (!data) {
		return new Response('Not found', { status: 404 });
	}

	return new Response(data, {
		headers: {
			'Content-Type': entry.contentType,
			'Cache-Control': 'public, max-age=3600',
		}
	});
};