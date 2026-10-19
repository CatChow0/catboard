import { json, type RequestHandler } from '@sveltejs/kit';
import { access, constants } from 'node:fs/promises';
import { configDir } from '$lib/server/config';

/**
 * GET — liveness for Docker's HEALTHCHECK and monitoring tools. Public (no
 * session), tells nothing about the config: 200 when the server answers and
 * the config folder is writable, 503 otherwise.
 */
export const GET: RequestHandler = async () => {
	const writable = await access(configDir(), constants.W_OK).then(() => true, () => false);
	return json({ status: writable ? 'ok' : 'config-not-writable', uptime: Math.round(process.uptime()) }, { status: writable ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
};
