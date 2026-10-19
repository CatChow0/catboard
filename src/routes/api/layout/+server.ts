import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { locked } from '$lib/server/locked';
import { getLayout, setLayout, dashboardList, dashboardLayouts, setDashboardLayouts, resolveDashboard, normalizeDashboards, MAIN_DASHBOARD } from '$lib/server/config';
import type { Layout } from '$lib/types';
import { requireEditor } from '$lib/server/auth';
import { apiError } from '$lib/server/api-error';

/**
 * GET ?dashboard=<id> — the grid config, the dashboard list and the requested
 * dashboard's per-breakpoint layouts (in `layouts`, like the historical format).
 */
export const GET: RequestHandler = async ({ url }) => {
	const data = await getLayout();
	const id = resolveDashboard(data, url.searchParams.get('dashboard'));
	const view: Layout = { grid: data.grid, layouts: dashboardLayouts(data, id), dashboards: dashboardList(data), dashboard: id };
	return json(view);
};

/** PUT ?dashboard=<id> — saves that dashboard's layouts (and the grid config). */
export const PUT: RequestHandler = locked('layout', async ({ request, url, locals }) => {
	const denied = await requireEditor(locals);
	if (denied) return denied;
	const body = (await request.json()) as Partial<Layout>;
	if (!body || typeof body.layouts !== 'object' || !body.layouts) return apiError(400, 'errors.layoutsMissing');
	const data = await getLayout();
	// The body comes from a GET of one dashboard and carries its id: trust it over
	// the URL, so a save that finishes after the user switched still lands right.
	const requested = (typeof body.dashboard === 'string' && body.dashboard) || url.searchParams.get('dashboard') || MAIN_DASHBOARD;
	// Never write into another dashboard: a stale tab may still show a deleted one.
	if (!dashboardList(data).some((d) => d.id === requested)) return apiError(409, 'errors.dashboardGone');
	if (body.grid) data.grid = body.grid;
	setDashboardLayouts(data, requested, body.layouts);
	normalizeDashboards(data);
	await setLayout(data);
	const view: Layout = { grid: data.grid, layouts: dashboardLayouts(data, requested), dashboards: dashboardList(data), dashboard: requested };
	return json(view);
});
