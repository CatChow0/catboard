import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getLayout, setLayout } from '$lib/server/config';

export const GET: RequestHandler = async () => {
	const data = await getLayout();
	return json(data);
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = await request.json();
	await setLayout(body);
	return json(body);
};