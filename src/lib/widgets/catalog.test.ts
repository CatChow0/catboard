import { describe, expect, it } from 'vitest';
import { WIDGETS, WIDGET_CATEGORIES, widgetForType, draftFor, configFrom, missingConnections, type WidgetDef } from './catalog';
import { GRID_WIDGETS, NAVBAR_WIDGETS } from './loaders';
import { GLYPHS } from './glyphs';
import { INTEGRATIONS } from '$lib/integrations/registry';
import type { IntegrationsConfig } from '$lib/types';

const conn: IntegrationsConfig = {
	docker: { environments: [{ id: 'env1', name: 'Local', url: '/var/run/docker.sock' }] },
	stacker: { servers: [{ id: 'srv1', name: 'Home', url: 'http://stacker' }] },
	proxmox: { clusters: [{ id: 'c1', name: 'Lab', url: 'https://pve:8006', tokenId: 'a@pve!b', tokenSecret: 's' }] },
	elegoo: { printers: [{ id: 'p1', name: 'CC2', host: '10.0.0.5' }] }
};
const targets = (w: WidgetDef) => [...(w.grid ? (['grid'] as const) : []), ...(w.navbar ? (['navbar'] as const) : [])];

describe('catalog definitions', () => {
	it('ids and types are unique', () => {
		const ids = WIDGETS.map((w) => w.id);
		expect(new Set(ids).size).toBe(ids.length);
		const types = WIDGETS.flatMap((w) => [w.grid?.type, w.navbar?.type]).filter(Boolean);
		expect(new Set(types).size).toBe(types.length);
	});

	it.each(WIDGETS.map((w) => [w.id, w] as const))('%s is well formed', (_id, w) => {
		expect(WIDGET_CATEGORIES).toContain(w.category);
		expect(GLYPHS[w.icon]).toBeDefined();
		expect(w.grid || w.navbar).toBeTruthy();
		for (const k of w.integrations ?? []) expect(INTEGRATIONS.some((d) => d.key === k), k).toBe(true);
		if (w.grid) expect(w.grid.colSpan * w.grid.rowSpan).toBeGreaterThan(0);
	});

	it('every widget type can be rendered (a lazy loader is registered)', () => {
		const builtIn = new Set(['group-collapsible', 'group-standard', 'navbar-search']);
		const missing = WIDGETS.flatMap((w) => [
			...(w.grid && !builtIn.has(w.grid.type) && !GRID_WIDGETS[w.grid.type] ? [w.grid.type] : []),
			...(w.navbar && !builtIn.has(w.navbar.type) && !NAVBAR_WIDGETS[w.navbar.type] ? [w.navbar.type] : [])
		]);
		expect(missing).toEqual([]);
	});

	it('widgetForType finds grid and navbar types', () => {
		expect(widgetForType('jenkins')?.id).toBe('jenkins');
		expect(widgetForType('navbar-jenkins')?.id).toBe('jenkins');
		expect(widgetForType('nope')).toBeUndefined();
	});
});

describe('prepare / normalize', () => {
	const cases = WIDGETS.flatMap((w) => targets(w).map((t) => [`${w.id} (${t})`, w, t] as const));

	it.each(cases)('%s: saving an untouched form is stable', (_n, w, t) => {
		const first = configFrom(w, draftFor(w, undefined, t, conn), t);
		const second = configFrom(w, draftFor(w, first, t, conn), t);
		expect(JSON.parse(JSON.stringify(second))).toEqual(JSON.parse(JSON.stringify(first)));
	});

	it('drafts never share objects with the saved config', () => {
		const w = widgetForType('stacker')!;
		const saved = { serverId: 'srv1', sections: { cpu: true, memory: true, gpu: true, disk: true, network: true } };
		const draft = draftFor(w, saved, 'grid', conn);
		draft.sections.cpu = false;
		expect(saved.sections.cpu).toBe(true);
	});

	it('normalize clamps numbers and leaves defaults out', () => {
		const jenkins = widgetForType('jenkins')!;
		expect(configFrom(jenkins, { mode: 'all', job: 'x', limit: 999 }, 'grid')).toEqual({ job: undefined, limit: 50 });
		expect(configFrom(jenkins, { mode: 'job', job: 'team/deploy', limit: '' }, 'grid')).toEqual({ job: 'team/deploy', limit: 8 });
		const immich = widgetForType('immich')!;
		expect(configFrom(immich, { showStats: true, photos: -4 }, 'grid')).toEqual({ showStats: undefined, photos: 0 });
	});

	it('new widgets pick the first connection', () => {
		expect(draftFor(widgetForType('proxmox')!, undefined, 'grid', conn).clusterId).toBe('c1');
		expect(draftFor(widgetForType('docker')!, undefined, 'grid', conn).environmentId).toBe('env1');
	});
});

describe('missing', () => {
	it('blocks widgets until their required choice is made', () => {
		const jenkins = widgetForType('jenkins')!;
		expect(jenkins.missing!({ mode: 'job', job: '' })).toBe('Pick a project');
		expect(jenkins.missing!({ mode: 'all', job: '' })).toBeNull();
		expect(widgetForType('proxmox')!.missing!({ clusterId: '' })).toBe('Pick a cluster');
	});
});

describe('missingConnections', () => {
	it('lists the connections a widget still needs', () => {
		expect(missingConnections(widgetForType('jenkins')!, {})).toEqual(['jenkins']);
		expect(missingConnections(widgetForType('proxmox')!, conn)).toEqual([]);
		expect(missingConnections(widgetForType('clock')!, {})).toEqual([]);
	});
});
