import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServices, setServices } from '$lib/server/config';
import { resolveIcon } from '$lib/server/icon-cache';
import { requireEditor } from '$lib/server/auth';
import { v4 as uuidv4 } from 'uuid';

export const GET: RequestHandler = async () => {
	const data = await getServices();
	return json(data);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = await requireEditor(locals);
	if (denied) return denied;
	const data = await getServices();
	const body = await request.json();

	const service = {
		id: uuidv4(),
		name: body.name || '',
		url: body.url || '',
		icon: body.icon || '',
		description: body.description || '',
		statusCheck: body.statusCheck || { enabled: true, method: 'HEAD' }
	};

	data.services.push(service);
	await setServices(data);
	// Warm the icon cache in the background so the tile shows it right away.
	void resolveIcon(service.icon, service.name, service.url).catch(() => null);
	return json(service, { status: 201 });
};