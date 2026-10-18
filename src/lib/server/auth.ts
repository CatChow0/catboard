import { json } from '@sveltejs/kit';

/** Admins (admin and mini-admin) may act on integrations and change their settings. */
export function isAdmin(locals: App.Locals): boolean {
	return locals.role === 'admin' || locals.role === 'mini-admin';
}

/**
 * Guard for routes that change something on a service or in the integration
 * settings. Returns a 403 response to send back, or null when allowed.
 */
export function requireAdmin(locals: App.Locals): Response | null {
	return isAdmin(locals) ? null : json({ error: 'Only an admin can do this' }, { status: 403 });
}

const SECRET_KEYS = new Set(['apiKey', 'password', 'accessCode', 'apiToken', 'uploadPassword']);

/** Deep copy with every secret field blanked, for non-admin readers. */
export function maskSecrets<T>(value: T): T {
	if (Array.isArray(value)) return value.map(maskSecrets) as T;
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEYS.has(k) && typeof v === 'string' ? '' : maskSecrets(v);
		return out as T;
	}
	return value;
}
