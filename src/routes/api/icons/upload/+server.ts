import { json, type RequestHandler } from '@sveltejs/kit';
import { saveUpload, MAX_UPLOAD_BYTES } from '$lib/server/icon-cache';
import { requireEditor } from '$lib/server/auth';

/** POST <image bytes> — store a custom service icon; returns {icon: "custom:<file>"}. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = await requireEditor(locals);
	if (denied) return denied;
	const len = Number(request.headers.get('content-length') || 0);
	if (len > MAX_UPLOAD_BYTES) return json({ error: 'Image too large (max 1 MB)' }, { status: 413 });
	const data = Buffer.from(await request.arrayBuffer());
	if (!data.length) return json({ error: 'Empty file' }, { status: 400 });
	try {
		return json({ icon: await saveUpload(data) });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 });
	}
};
