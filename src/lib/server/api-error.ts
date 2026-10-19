// Errors the API sends with a translation key, so the interface shows them in
// the user's language: `{ error: <English text>, code: <key>, params }`.
// Integration clients throw AppError; routes answer with errorBody(err).
import { json } from '@sveltejs/kit';
import { translate, type Key, type Params } from '$lib/i18n';

export class AppError extends Error {
	constructor(
		readonly code: Key,
		readonly params: Params = {}
	) {
		super(translate('en', code, params));
	}
}

export function errorBody(err: unknown): { error: string; code?: Key; params?: Params } {
	if (err instanceof AppError) return { error: err.message, code: err.code, params: err.params };
	return { error: err instanceof Error ? err.message : String(err) };
}

/** A JSON error response with a translation key. */
export function apiError(status: number, code: Key, params: Params = {}) {
	return json({ error: translate('en', code, params), code, params }, { status });
}

/** A test result message with a translation key: `{ ok, ...msg(key) }`. */
export function msg(code: Key, params: Params = {}): { message: string; code: Key; params: Params } {
	return { message: translate('en', code, params), code, params };
}
