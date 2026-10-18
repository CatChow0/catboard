import { describe, expect, it } from 'vitest';
import { isAdmin, maskSecrets, requireAdmin } from './auth';

const locals = (role: string | null) => ({ role, username: 'x', isAuthenticated: true }) as unknown as App.Locals;

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
		expect(await res.json()).toEqual({ error: 'Only an admin can do this' });
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
