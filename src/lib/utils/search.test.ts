import { describe, expect, it } from 'vitest';
import type { DashboardItem, Service } from '$lib/types';
import { itemLabel, itemMatchesQuery, matchingItemIds, searchDashboards, WIDGET_NAMES } from './search';
import { WIDGETS } from '$lib/widgets/catalog';

const services = [
	{ id: 's1', name: 'Plex', url: 'http://plex', description: 'Movies at home' },
	{ id: 's2', name: 'Grafana', url: 'http://grafana' }
] as Service[];

const svc = (id: string, serviceId: string) => ({ id, type: 'service', serviceId, col: 0, row: 0, colSpan: 1, rowSpan: 1 }) as DashboardItem;
const group = (id: string, title: string, children: DashboardItem[]) =>
	({ id, type: 'group-standard', title, children, col: 0, row: 0, colSpan: 2, rowSpan: 2 }) as unknown as DashboardItem;
const widget = (id: string, type: string, config?: object) => ({ id, type, config, col: 0, row: 0, colSpan: 1, rowSpan: 1 }) as DashboardItem;

describe('itemLabel', () => {
	it('names services, groups and widgets', () => {
		expect(itemLabel(svc('a', 's1'), services)).toBe('Plex');
		expect(itemLabel(svc('a', 'gone'), services)).toBe('Service');
		expect(itemLabel(group('g', 'Media', []), services)).toBe('Media');
		expect(itemLabel(widget('w', 'clock'), services)).toBe('Clock');
		expect(itemLabel(widget('w', 'notes', { title: 'Todo' }), services)).toBe('Todo (Notes)');
	});
});

describe('itemMatchesQuery', () => {
	it('matches service name and description, case-insensitively', () => {
		expect(itemMatchesQuery(svc('a', 's1'), 'PLE', services)).toBe(true);
		expect(itemMatchesQuery(svc('a', 's1'), 'movies', services)).toBe(true);
		expect(itemMatchesQuery(svc('a', 's2'), 'movies', services)).toBe(false);
	});
	it('matches widget names and aliases', () => {
		expect(itemMatchesQuery(widget('w', 'qbittorrent'), 'torrent', services)).toBe(true);
		expect(itemMatchesQuery(widget('w', 'proxmox'), 'vm', services)).toBe(true);
	});
	it('never matches an empty query', () => {
		expect(itemMatchesQuery(svc('a', 's1'), '   ', services)).toBe(false);
	});
});

describe('matchingItemIds', () => {
	it('looks inside groups', () => {
		const items = [group('g', 'Monitoring', [svc('c1', 's2')]), svc('a', 's1')];
		expect([...matchingItemIds(items, 'grafana', services)]).toEqual(['c1']);
		expect([...matchingItemIds(items, 'monitor', services)]).toEqual(['g']);
	});
});

describe('searchDashboards', () => {
	const index = [
		{ id: 'main', name: 'Home', items: [svc('a', 's1')] },
		{ id: 'ops', name: 'Ops', items: [group('g', 'Tools', [svc('b', 's1')])] }
	];
	it('lists the current dashboard first, with the group of nested hits', () => {
		const res = searchDashboards(index, 'plex', services, 'ops');
		expect(res.map((r) => r.dashboardId)).toEqual(['ops', 'main']);
		expect(res[0].hits[0]).toMatchObject({ itemId: 'b', label: 'Plex', group: 'Tools' });
	});
	it('drops dashboards without hits and returns nothing for an empty query', () => {
		expect(searchDashboards(index, 'grafana', services, 'main')).toEqual([]);
		expect(searchDashboards(index, '', services, 'main')).toEqual([]);
	});
});

describe('widget names', () => {
	it('every catalog widget can be found by its name', () => {
		const missing = WIDGETS.filter((w) => w.grid && !w.group).map((w) => w.grid!.type).filter((t) => !WIDGET_NAMES[t]);
		expect(missing).toEqual([]);
	});
});
