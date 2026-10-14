import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getLayout, dashboardList, dashboardLayouts } from '$lib/server/config';

/** GET ?breakpoint=<id> — every dashboard with its tiles at that breakpoint (search index). */
export const GET: RequestHandler = async ({ url }) => {
	const data = await getLayout();
	const bp = url.searchParams.get('breakpoint') || '';
	const result = dashboardList(data).map((d) => ({ id: d.id, name: d.name, items: dashboardLayouts(data, d.id)[bp]?.items ?? [] }));
	return json(result, { headers: { 'Cache-Control': 'no-store' } });
};
