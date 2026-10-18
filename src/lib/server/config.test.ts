import { describe, expect, it } from 'vitest';
import type { Layout } from '$lib/types';
import { allBreakpointLayouts, dashboardLayouts, dashboardList, ensureTitle, normalizeDashboards, resolveDashboard, setDashboardLayouts } from './config';

const bp = (items = 0) => ({ items: Array.from({ length: items }, (_, i) => ({ id: `i${i}`, type: 'clock', col: i, row: 0, colSpan: 1, rowSpan: 1 })), navbar: { columns: 12, items: [] } });
const layout = (): Layout =>
	({
		grid: { cellSize: 80, gap: 12, breakpoints: [{ id: 'mobile', name: 'Mobile', minWidth: 0, columns: 4 }, { id: 'desktop', name: 'Desktop', minWidth: 1200, columns: 10 }] },
		layouts: { mobile: bp(), desktop: bp(2) }
	}) as unknown as Layout;

describe('dashboards', () => {
	it('a layout without a list has just "main"', () => {
		expect(dashboardList(layout())).toEqual([{ id: 'main', name: 'Home' }]);
	});
	it('main lives in layouts, the others in pages', () => {
		const l = layout();
		l.dashboards = [{ id: 'main', name: 'Home' }, { id: 'ops', name: 'Ops' }];
		setDashboardLayouts(l, 'ops', { desktop: bp(1) } as never);
		expect(dashboardLayouts(l, 'ops').desktop.items).toHaveLength(1);
		expect(dashboardLayouts(l, 'main').desktop.items).toHaveLength(2);
		expect(dashboardLayouts(l, 'unknown')).toBe(l.layouts);
		expect(allBreakpointLayouts(l)).toHaveLength(3);
	});
	it('resolveDashboard falls back to the first dashboard', () => {
		const l = layout();
		l.dashboards = [{ id: 'main', name: 'Home' }, { id: 'ops', name: 'Ops' }];
		expect(resolveDashboard(l, 'ops')).toBe('ops');
		expect(resolveDashboard(l, 'gone')).toBe('main');
		expect(resolveDashboard(l, null)).toBe('main');
	});
});

describe('ensureTitle', () => {
	it('adds a title in the first free span', () => {
		const navbar = { columns: 12, items: [{ id: 's', type: 'navbar-search', col: 0, colSpan: 3 }] } as never as Layout['layouts'][string]['navbar'];
		expect(ensureTitle(navbar)).toBe(true);
		const title = navbar.items.find((i) => i.type === 'navbar-title')!;
		expect(title).toMatchObject({ col: 3, colSpan: 2 });
		expect(ensureTitle(navbar)).toBe(false);
	});
	it('keeps only the first of several titles', () => {
		const navbar = { columns: 12, items: [{ id: 'a', type: 'navbar-title', col: 0, colSpan: 2 }, { id: 'b', type: 'navbar-title', col: 4, colSpan: 2 }] } as never as Layout['layouts'][string]['navbar'];
		expect(ensureTitle(navbar)).toBe(true);
		expect(navbar.items.map((i) => i.id)).toEqual(['a']);
	});
});

describe('normalizeDashboards', () => {
	it('fills every breakpoint of every dashboard and puts main back in the list', () => {
		const l = layout();
		delete (l.layouts as Record<string, unknown>).mobile;
		l.dashboards = [{ id: 'ops', name: 'Ops' }];
		expect(normalizeDashboards(l)).toBe(true);
		expect(l.dashboards.map((d) => d.id)).toEqual(['main', 'ops']);
		expect(Object.keys(l.layouts).sort()).toEqual(['desktop', 'mobile']);
		expect(Object.keys(l.pages!.ops).sort()).toEqual(['desktop', 'mobile']);
		for (const p of allBreakpointLayouts(l)) expect(p.navbar.items.filter((i) => i.type === 'navbar-title')).toHaveLength(1);
		expect(normalizeDashboards(l)).toBe(false);
	});
});
