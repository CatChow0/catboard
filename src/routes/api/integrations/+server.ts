import { json } from '@sveltejs/kit';
import { locked } from '$lib/server/locked';
import type { RequestHandler } from './$types';
import { getIntegrations, setIntegrations } from '$lib/server/config';
import { isAdmin, maskSecrets, requireAdmin } from '$lib/server/auth';
import type { IntegrationsConfig } from '$lib/types';
import { randomBytes } from 'node:crypto';

// Widgets need the integration list (names, URLs, ids), but only admins get
// the secrets (API keys, passwords) or may change the connections.
export const GET: RequestHandler = async ({ locals }) => {
	const data = await getIntegrations();
	return json(isAdmin(locals) ? data : maskSecrets(data));
};

export const PUT: RequestHandler = locked('integrations', async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const data = await request.json();
	const current = await getIntegrations();
	const next: Record<string, unknown> = { ...current };
	// Each top-level key replaces the stored one; null removes the connection.
	for (const [key, value] of Object.entries(data ?? {})) {
		if (value === null) delete next[key];
		else next[key] = value;
	}
	// Deezer to Navidrome calls back with a secret URL: make it once, keep it across saves.
	const deezer = next.deezer as IntegrationsConfig['deezer'];
	if (deezer && !deezer.webhookToken) next.deezer = { ...deezer, webhookToken: current.deezer?.webhookToken || randomBytes(24).toString('base64url') };
	await setIntegrations(next as IntegrationsConfig);
	return json({ ok: true });
});
