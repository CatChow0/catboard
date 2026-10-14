import { json, type RequestHandler } from '@sveltejs/kit';
import { iconCatalog } from '$lib/server/icon-cache';

/** GET — selfh.st and homarr icon catalogs, merged (cached by the server for a day). */
export const GET: RequestHandler = async () => {
	const icons = await iconCatalog();
	return json(icons, { headers: { 'Cache-Control': 'private, max-age=86400' } });
};
