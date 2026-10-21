import { json, type RequestHandler } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { getIntegrations } from '$lib/server/config';
import { deezerChanged } from '$lib/server/arr';
import { apiError } from '$lib/server/api-error';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * POST ?token=… — called by deezer-to-navidrome when its release feed or its
 * library index changed (no session: the token in the URL is the secret, see
 * hooks.server.ts). The Deezer entries are dropped from the cache, so the
 * Calendar and New releases widgets show the new feed at their next refresh.
 */
export const POST: RequestHandler = async ({ url, request }) => {
	const expected = (await getIntegrations()).deezer?.webhookToken ?? '';
	const token = url.searchParams.get('token') ?? '';
	if (!expected || !same(token, expected)) return apiError(401, 'errors.unauthorized');
	const body = (await request.json().catch(() => ({}))) as { event?: string };
	if (body.event !== 'test') deezerChanged();
	return json({ ok: true });
};
