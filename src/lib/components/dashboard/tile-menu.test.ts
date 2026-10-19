import { describe, expect, it, vi } from 'vitest';
import { tileMenu, transferTargets, type TileMenuContext } from './tile-menu';

const ctx = (over: Partial<TileMenuContext> = {}): TileMenuContext => ({
	dashboards: [{ id: 'main', name: 'Home' }, { id: 'ops', name: 'Ops' }],
	breakpoints: [
		{ id: 'mobile', name: 'Mobile', minWidth: 0, columns: 4 },
		{ id: 'tablet', name: 'Tablet', minWidth: 800, columns: 6 },
		{ id: 'desktop', name: 'Desktop', minWidth: 1200, columns: 10 }
	],
	activeDashboard: 'ops',
	activeBreakpoint: 'tablet',
	label: (bp) => bp.toUpperCase(),
	transfer: vi.fn(),
	remove: vi.fn(),
	...over
});

describe('transferTargets', () => {
	it('lists the current dashboard and breakpoint first, then the widest', () => {
		const t = transferTargets(ctx(), true);
		expect(t.map((d) => d.label)).toEqual(['Ops', 'Home']);
		expect(t[0].hint).toBe('current');
		expect(t[0].children!.map((b) => b.label)).toEqual(['TABLET', 'DESKTOP', 'MOBILE']);
	});

	it('copying onto the current spot duplicates, moving there is disabled', () => {
		expect(transferTargets(ctx(), true)[0].children![0]).toMatchObject({ hint: 'duplicate', disabled: false });
		expect(transferTargets(ctx(), false)[0].children![0]).toMatchObject({ hint: 'here', disabled: true });
		expect(transferTargets(ctx(), false)[1].children![0]).toMatchObject({ hint: 'current', disabled: false });
	});

	it('runs the transfer with the picked target', () => {
		const c = ctx();
		transferTargets(c, false)[1].children![1].onselect!();
		expect(c.transfer).toHaveBeenCalledWith('main', 'desktop', false);
	});
});

describe('tileMenu', () => {
	it('names the delete entry after the selection size', () => {
		expect(tileMenu(ctx(), 1).map((i) => i.label)).toEqual(['Copy to', 'Move to', 'Delete']);
		const c = ctx();
		const del = tileMenu(c, 3)[2];
		expect(del).toMatchObject({ label: 'Delete 3 tiles', danger: true });
		del.onselect!();
		expect(c.remove).toHaveBeenCalled();
	});
});
