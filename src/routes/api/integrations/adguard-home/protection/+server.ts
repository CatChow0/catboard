import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getIntegrations } from '$lib/server/config';
import { pausedInstances, basicAuth, setAdGuardProtection } from '$lib/server/adguard-home';

export const POST: RequestHandler = async ({ request }) => {
	const integrations = await getIntegrations();
	if (!integrations.adguardHome?.url) {
		return json({ error: 'Not configured' }, { status: 404 });
	}

	const body = await request.json().catch(() => ({}));
	const enabled = !!body.enabled;
	const duration = typeof body.duration === 'number' && body.duration > 0 ? body.duration : null;
	const instanceId = typeof body.instanceId === 'string' ? body.instanceId : 'default';

	const conn = integrations.adguardHome;
	const auth = basicAuth(conn.username, conn.password);

	try {
		await setAdGuardProtection(conn.url, auth, enabled);

		if (!enabled && duration) {
			pausedInstances.set(instanceId, Date.now() + duration * 1000);
		} else if (enabled) {
			pausedInstances.delete(instanceId);
		}

		return json({ success: true, enabled, pausedUntil: pausedInstances.get(instanceId) || null });
	} catch (err: any) {
		return json({ error: err?.message || 'Failed to toggle protection' }, { status: 502 });
	}
};
