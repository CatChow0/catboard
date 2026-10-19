// Edit-mode context menu of the dashboard: Copy to / Move to a dashboard x
// breakpoint, Delete. Pure: Dashboard.svelte passes the state and the actions.
import type { Breakpoint, DashboardMeta } from '$lib/types';
import type { MenuItem } from '../ContextMenu.svelte';

export interface TileMenuContext {
	dashboards: DashboardMeta[];
	breakpoints: Breakpoint[];
	activeDashboard: string;
	activeBreakpoint: string;
	label: (breakpointId: string) => string;
	transfer: (to: string, breakpoint: string, copy: boolean) => void;
	remove: () => void;
}

/** Dashboards (current first) > breakpoints (current first, then widest). Moving onto the current spot is disabled. */
export function transferTargets(ctx: TileMenuContext, copy: boolean): MenuItem[] {
	const bps = [...ctx.breakpoints].sort((a, b) => (a.id === ctx.activeBreakpoint ? -1 : b.id === ctx.activeBreakpoint ? 1 : b.minWidth - a.minWidth));
	const dashes = [...ctx.dashboards].sort((a, b) => (a.id === ctx.activeDashboard ? -1 : b.id === ctx.activeDashboard ? 1 : 0));
	return dashes.map((d) => ({
		label: d.name,
		hint: d.id === ctx.activeDashboard ? 'current' : undefined,
		children: bps.map((bp) => {
			const here = d.id === ctx.activeDashboard && bp.id === ctx.activeBreakpoint;
			return {
				label: ctx.label(bp.id),
				hint: here ? (copy ? 'duplicate' : 'here') : bp.id === ctx.activeBreakpoint ? 'current' : undefined,
				disabled: here && !copy,
				onselect: () => ctx.transfer(d.id, bp.id, copy)
			};
		})
	}));
}

export function tileMenu(ctx: TileMenuContext, count: number): MenuItem[] {
	return [
		{ label: 'Copy to', children: transferTargets(ctx, true) },
		{ label: 'Move to', children: transferTargets(ctx, false) },
		{ label: count > 1 ? `Delete ${count} tiles` : 'Delete', danger: true, onselect: ctx.remove }
	];
}
