import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { findPrinter, clientFor, METHOD } from '$lib/server/elegoo-cc2';

const ACTIONS = { pause: METHOD.pause, resume: METHOD.resume, stop: METHOD.stop } as const;

/** POST {printer, action: 'pause' | 'resume' | 'stop'} — admins only. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const body = await request.json().catch(() => ({}));
	const method = ACTIONS[body?.action as keyof typeof ACTIONS];
	if (!method) return json({ error: 'Unknown action' }, { status: 400 });
	const printer = await findPrinter(String(body?.printer || ''));
	if (!printer) return json({ error: 'Printer not configured' }, { status: 404 });
	try {
		await clientFor(printer).request(method);
		return json({ ok: true });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : 'Action failed' }, { status: 502 });
	}
};
