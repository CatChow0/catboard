import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServices, setServices } from '$lib/server/config';

export const GET: RequestHandler = async ({ params }) => {
	const data = await getServices();
	const service = data.services.find((s) => s.id === params.id);
	if (!service) return json({ error: 'Not found' }, { status: 404 });
	return json(service);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const data = await getServices();
	const index = data.services.findIndex((s) => s.id === params.id);
	if (index === -1) return json({ error: 'Not found' }, { status: 404 });

	const body = await request.json();
	data.services[index] = { ...data.services[index], ...body };
	await setServices(data);
	return json(data.services[index]);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const data = await getServices();
	const index = data.services.findIndex((s) => s.id === params.id);
	if (index === -1) return json({ error: 'Not found' }, { status: 404 });

	data.services.splice(index, 1);
	await setServices(data);
	return json({ success: true });
};