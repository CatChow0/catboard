import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { locked } from '$lib/server/locked';
import { getServices, setServices } from '$lib/server/config';
import { resolveIcon } from '$lib/server/icon-cache';
import { requireEditor } from '$lib/server/auth';
import { apiError } from '$lib/server/api-error';

export const GET: RequestHandler = async ({ params }) => {
	const data = await getServices();
	const service = data.services.find((s) => s.id === params.id);
	if (!service) return apiError(404, 'errors.notFound');
	return json(service);
};

export const PUT: RequestHandler = locked('services', async ({ params, request, locals }) => {
	const denied = await requireEditor(locals);
	if (denied) return denied;
	const data = await getServices();
	const index = data.services.findIndex((s) => s.id === params.id);
	if (index === -1) return apiError(404, 'errors.notFound');

	const body = await request.json();
	data.services[index] = { ...data.services[index], ...body };
	await setServices(data);
	// Warm the icon cache in the background so the tile shows it right away.
	const s = data.services[index];
	void resolveIcon(s.icon || '', s.name || '', s.url || '').catch(() => null);
	return json(data.services[index]);
});

export const DELETE: RequestHandler = locked('services', async ({ params, locals }) => {
	const denied = await requireEditor(locals);
	if (denied) return denied;
	const data = await getServices();
	const index = data.services.findIndex((s) => s.id === params.id);
	if (index === -1) return apiError(404, 'errors.notFound');

	data.services.splice(index, 1);
	await setServices(data);
	return json({ success: true });
});