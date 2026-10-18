import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { pveConn, guestAction, GUEST_ACTIONS, type GuestAction } from '$lib/server/proxmox';

/** POST {cluster, node, type, vmid, action} — start / shut down / reboot / stop a guest (admins). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const body = await request.json().catch(() => ({}));
	const conn = await pveConn(String(body?.cluster ?? ''));
	if (!conn) return json({ error: 'Proxmox is not set up' }, { status: 404 });
	const node = String(body?.node ?? '');
	const type = body?.type;
	const vmid = Number(body?.vmid);
	const action = body?.action as GuestAction;
	if (!/^[\w.-]{1,64}$/.test(node) || (type !== 'qemu' && type !== 'lxc') || !Number.isInteger(vmid) || vmid < 1 || !GUEST_ACTIONS.includes(action)) {
		return json({ error: 'Invalid guest or action' }, { status: 400 });
	}
	try {
		return json({ ok: true, task: await guestAction(conn, node, type, vmid, action) });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
	}
};
