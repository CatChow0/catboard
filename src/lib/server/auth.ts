import { json } from '@sveltejs/kit';
import { getAccess } from '$lib/server/config';
import { apiError } from '$lib/server/api-error';

/** Admins (admin and mini-admin) may act on integrations and change their settings. */
export function isAdmin(locals: App.Locals): boolean {
	return locals.role === 'admin' || locals.role === 'mini-admin';
}

/**
 * Guard for routes that change something on a service or in the integration
 * settings. Returns a 403 response to send back, or null when allowed.
 */
export function requireAdmin(locals: App.Locals): Response | null {
	return isAdmin(locals) ? null : apiError(403, 'errors.adminOnly');
}

/** Admins, or every signed-in user when Settings > Admin allows it. */
export async function canEditDashboards(locals: App.Locals): Promise<boolean> {
	if (!locals.isAuthenticated) return false;
	return isAdmin(locals) || (await getAccess()).dashboardEditors === 'everyone';
}

/** Guard for routes that change the shared dashboards: a 403 response, or null when allowed. */
export async function requireEditor(locals: App.Locals): Promise<Response | null> {
	return (await canEditDashboards(locals)) ? null : apiError(403, 'errors.adminDashboards');
}

const SECRET_KEYS = new Set(['apiKey', 'password', 'accessCode', 'apiToken', 'uploadPassword', 'tokenSecret', 'appPassword', 'webhookToken']);

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
