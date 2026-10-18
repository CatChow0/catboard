import { describe, expect, it } from 'vitest';
import { INTEGRATIONS, INTEGRATION_CATEGORIES, integrationDef, itemsOf, isConfigured, cleanValue } from './registry';
import { GLYPHS } from '$lib/widgets/glyphs';
import type { IntegrationsConfig } from '$lib/types';

describe('registry definitions', () => {
	it('keys are unique', () => {
		const keys = INTEGRATIONS.map((d) => d.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it.each(INTEGRATIONS.map((d) => [d.key, d] as const))('%s is well formed', (_k, d) => {
		expect(INTEGRATION_CATEGORIES).toContain(d.category);
		expect(GLYPHS[d.icon]).toBeDefined();
		const ids = d.fields.map((f) => f.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain(d.requiredField);
		if (d.kind === 'list') {
			expect(d.listKey).toBeTruthy();
			expect(d.itemName).toBeTruthy();
		}
		// The required field must be visible, not tucked in "Advanced".
		expect(d.fields.find((f) => f.id === d.requiredField)?.advanced).toBeFalsy();
	});

	it('integrationDef finds a definition by key', () => {
		expect(integrationDef('jenkins')?.name).toBe('Jenkins');
		expect(integrationDef('nope' as never)).toBeUndefined();
	});
});

describe('itemsOf / isConfigured', () => {
	const cfg: IntegrationsConfig = {
		jenkins: { url: 'http://jenkins:8080', username: 'u', apiToken: 't' },
		docker: { environments: [{ id: 'e1', name: 'Local', url: '' }, { id: 'e2', name: 'NAS', url: 'tcp://nas:2375' }] },
		stacker: { servers: [] }
	};
	it('single connections are one item, lists are their items', () => {
		expect(itemsOf(integrationDef('jenkins')!, cfg)).toHaveLength(1);
		expect(itemsOf(integrationDef('docker')!, cfg)).toHaveLength(2);
		expect(itemsOf(integrationDef('radarr')!, cfg)).toEqual([]);
	});
	it('needs the required field on at least one item', () => {
		expect(isConfigured('jenkins', cfg)).toBe(true);
		expect(isConfigured('docker', cfg)).toBe(true);
		expect(isConfigured('stacker', cfg)).toBe(false);
		expect(isConfigured('radarr', cfg)).toBe(false);
	});
});

describe('cleanValue', () => {
	it('trims text but keeps secrets exactly as typed', () => {
		expect(cleanValue(integrationDef('jenkins')!, [{ url: ' http://j:8080 ', username: ' bob ', apiToken: ' tok ' }])).toEqual({ url: 'http://j:8080', username: 'bob', apiToken: ' tok ' });
	});
	it('drops empty optional fields and clears a single connection without URL', () => {
		expect(cleanValue(integrationDef('psitransfer')!, [{ url: 'http://p', publicUrl: '  ', uploadPassword: '' }])).toEqual({ url: 'http://p' });
		expect(cleanValue(integrationDef('psitransfer')!, [{ url: '   ' }])).toBeUndefined();
	});
	it('removes list items without the required field', () => {
		const v = cleanValue(integrationDef('proxmox')!, [{ id: 'a', name: 'Lab', url: 'https://pve:8006' }, { id: 'b', name: 'Empty', url: '' }]);
		expect(v).toEqual({ clusters: [{ id: 'a', name: 'Lab', url: 'https://pve:8006' }] });
	});
	it('drops a Stacker password without username and names unnamed printers', () => {
		expect(cleanValue(integrationDef('stacker')!, [{ id: 's', url: 'http://s', password: 'p' }])).toEqual({ servers: [{ id: 's', url: 'http://s' }] });
		expect(cleanValue(integrationDef('elegoo')!, [{ id: 'p', host: '10.0.0.5' }])).toEqual({ printers: [{ id: 'p', host: '10.0.0.5', name: 'Centauri Carbon 2' }] });
	});
	it('keeps toggles as "true" and drops them when off', () => {
		expect(cleanValue(integrationDef('portainer')!, [{ url: 'https://p', apiKey: 'k', insecure: 'true' }])).toEqual({ url: 'https://p', apiKey: 'k', insecure: 'true' });
		expect(cleanValue(integrationDef('portainer')!, [{ url: 'https://p', apiKey: 'k', insecure: '' }])).toEqual({ url: 'https://p', apiKey: 'k' });
	});
});
