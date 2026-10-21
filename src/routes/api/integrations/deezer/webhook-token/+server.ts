import { json, type RequestHandler } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { locked } from '$lib/server/locked';
import { getIntegrations, setIntegrations } from '$lib/server/config';
import { requireAdmin } from '$lib/server/auth';
import { apiError } from '$lib/server/api-error';

/** POST — a new webhook secret (the old URL stops working). Admins only. */
export const POST: RequestHandler = locked('integrations', async ({ locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const all = await getIntegrations();
	if (!all.deezer?.url) return apiError(404, 'errors.notSetUp', { name: 'Deezer to Navidrome' });
	const webhookToken = randomBytes(24).toString('base64url');
	await setIntegrations({ ...all, deezer: { ...all.deezer, webhookToken } });
	return json({ ok: true, webhookToken });
});
