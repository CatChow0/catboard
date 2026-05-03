import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getIntegrations, setIntegrations } from '$lib/server/config';

export const GET: RequestHandler = async () => {
	const data = await getIntegrations();
	return json(data);
};

export const PUT: RequestHandler = async ({ request }) => {
	const data = await request.json();
	const current = await getIntegrations();
	await setIntegrations({ ...current, ...data });
	return json({ ok: true });
};