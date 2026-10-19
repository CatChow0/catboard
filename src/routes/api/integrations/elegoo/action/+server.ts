import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { findPrinter, clientFor, METHOD } from '$lib/server/elegoo-cc2';
import { apiError, errorBody } from '$lib/server/api-error';

const ACTIONS = { pause: METHOD.pause, resume: METHOD.resume, stop: METHOD.stop } as const;

/** POST {printer, action: 'pause' | 'resume' | 'stop'} — admins only. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = requireAdmin(locals);
	if (denied) return denied;
	const body = await request.json().catch(() => ({}));
	const method = ACTIONS[body?.action as keyof typeof ACTIONS];
	if (!method) return apiError(400, 'errors.unknownAction');
	const printer = await findPrinter(String(body?.printer || ''));
	if (!printer) return apiError(404, 'errors.printerNotConfigured');
	try {
		await clientFor(printer).request(method);
		return json({ ok: true });
	} catch (err) {
		return err instanceof Error ? json(errorBody(err), { status: 502 }) : apiError(502, 'errors.actionFailed');
	}
};
