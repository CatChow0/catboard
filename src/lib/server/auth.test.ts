import { describe, expect, it, vi } from 'vitest';
import { canEditDashboards, isAdmin, maskSecrets, requireAdmin, requireEditor } from './auth';

const access = vi.hoisted(() => ({ dashboardEditors: 'admins' as 'admins' | 'everyone' }));
vi.mock('$lib/server/config', () => ({ getAccess: async () => ({ ...access }) }));

const locals = (role: string | null, isAuthenticated = true) => ({ role, username: 'x', isAuthenticated }) as unknown as App.Locals;

describe('isAdmin / requireAdmin', () => {
	it('admins and mini-admins may act', () => {
		expect(isAdmin(locals('admin'))).toBe(true);
		expect(isAdmin(locals('mini-admin'))).toBe(true);
		expect(requireAdmin(locals('admin'))).toBeNull();
	});
	it('others get a 403', async () => {
		expect(isAdmin(locals('user'))).toBe(false);
		const res = requireAdmin(locals(null))!;
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: 'Only an admin can do this', code: 'errors.adminOnly' });
	});
});

describe('maskSecrets', () => {
	it('blanks every secret field, at any depth, and keeps the rest', () => {
		const cfg = {
			radarr: { url: 'http://radarr', apiKey: 'k1' },
			adguardHome: { url: 'http://adg', username: 'admin', password: 'p' },
			jenkins: { url: 'http://j', username: 'u', apiToken: 't' },
			psitransfer: { url: 'http://p', uploadPassword: 'up' },
			proxmox: { clusters: [{ id: 'c', url: 'https://pve', tokenId: 'a@pve!b', tokenSecret: 's' }] },
			nextcloud: { url: 'http://nc', username: 'u', appPassword: 'ap' },
			elegoo: { printers: [{ id: 'p', host: '10.0.0.5', accessCode: '1234' }] }
		};
		expect(maskSecrets(cfg)).toEqual({
			radarr: { url: 'http://radarr', apiKey: '' },
			adguardHome: { url: 'http://adg', username: 'admin', password: '' },
			jenkins: { url: 'http://j', username: 'u', apiToken: '' },
			psitransfer: { url: 'http://p', uploadPassword: '' },
			proxmox: { clusters: [{ id: 'c', url: 'https://pve', tokenId: 'a@pve!b', tokenSecret: '' }] },
			nextcloud: { url: 'http://nc', username: 'u', appPassword: '' },
			elegoo: { printers: [{ id: 'p', host: '10.0.0.5', accessCode: '' }] }
		});
	});
	it('does not modify the original', () => {
		const cfg = { immich: { url: 'http://i', apiKey: 'secret' } };
		maskSecrets(cfg);
		expect(cfg.immich.apiKey).toBe('secret');
	});
	it('passes plain values through', () => {
		expect(maskSecrets(null)).toBeNull();
		expect(maskSecrets('apiKey')).toBe('apiKey');
		expect(maskSecrets([1, { password: 'x' }])).toEqual([1, { password: '' }]);
	});
});

describe('canEditDashboards', () => {
	it('with "admins": only admins and mini-admins', async () => {
		access.dashboardEditors = 'admins';
		expect(await canEditDashboards(locals('admin'))).toBe(true);
		expect(await canEditDashboards(locals('mini-admin'))).toBe(true);
		expect(await canEditDashboards(locals('user'))).toBe(false);
		const res = (await requireEditor(locals('user')))!;
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: 'Only an admin can change the dashboards', code: 'errors.adminDashboards' });
	});

	it('with "everyone": every signed-in user, never an anonymous one', async () => {
		access.dashboardEditors = 'everyone';
		expect(await canEditDashboards(locals('user'))).toBe(true);
		expect(await requireEditor(locals('user'))).toBeNull();
		expect(await canEditDashboards(locals(null, false))).toBe(false);
	});
});
