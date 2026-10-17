import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getIntegrations, setIntegrations } from '$lib/server/config';
import { isAdmin, maskSecrets, requireAdmin } from '$lib/server/auth';
import type { IntegrationsConfig } from '$lib/types';

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
	const next: Record<string, unknown> = { ...(await getIntegrations()) };
	// Each top-level key replaces the stored one; null removes the connection.
	for (const [key, value] of Object.entries(data ?? {})) {
		if (value === null) delete next[key];
		else next[key] = value;
	}
	await setIntegrations(next as IntegrationsConfig);
	return json({ ok: true });
};
