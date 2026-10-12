import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getIntegrations, setIntegrations } from '$lib/server/config';
import { isAdmin, maskSecrets, requireAdmin } from '$lib/server/auth';

// Widgets need the integration list (names, URLs, ids), but only admins get
// the secrets (API keys, passwords) or may change the connections.
export const GET: RequestHandler = async ({ locals }) => {
	const data = await getIntegrations();
	return json(isAdmin(locals) ? data : maskSecrets(data));
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const data = await request.json();
	const current = await getIntegrations();
	await setIntegrations({ ...current, ...data });
	return json({ ok: true });
};
