import { json, type RequestHandler } from '@sveltejs/kit';
import { saveUpload, MAX_UPLOAD_BYTES } from '$lib/server/icon-cache';
import { requireEditor } from '$lib/server/auth';
import { apiError, errorBody } from '$lib/server/api-error';

/** POST <image bytes> — store a custom service icon; returns {icon: "custom:<file>"}. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = await requireEditor(locals);
	if (denied) return denied;
	const len = Number(request.headers.get('content-length') || 0);
	if (len > MAX_UPLOAD_BYTES) return apiError(413, 'errors.imageTooLarge');
	const data = Buffer.from(await request.arrayBuffer());
	if (!data.length) return apiError(400, 'errors.emptyFile');
	try {
		return json({ icon: await saveUpload(data) });
	} catch (err) {
		return json(errorBody(err), { status: 400 });
	}
};
