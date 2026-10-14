import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { discover } from '$lib/server/elegoo-cc2';

/** POST {host} — serial number, name and model of a CC2 (connection form "Detect"). Admins only. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const host = String((await request.json().catch(() => ({})))?.host || '').trim();
	// A hostname or IPv4/IPv6 address, nothing else.
	if (!/^[a-z0-9.:-]{1,253}$/i.test(host)) return json({ error: 'Enter the printer IP address' }, { status: 400 });
	try {
		return json(await discover(host));
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : 'Discovery failed' }, { status: 502 });
	}
};
