// Edit-mode context menu of the dashboard: Copy to / Move to a dashboard x
// breakpoint, Delete. Pure: Dashboard.svelte passes the state and the actions.
import type { Breakpoint, DashboardMeta } from '$lib/types';
import type { MenuItem } from '../ContextMenu.svelte';
import { tr } from '$lib/i18n';

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
		hint: d.id === ctx.activeDashboard ? tr('dashboard.current') : undefined,
		children: bps.map((bp) => {
			const here = d.id === ctx.activeDashboard && bp.id === ctx.activeBreakpoint;
			return {
				label: ctx.label(bp.id),
				hint: here ? tr(copy ? 'dashboard.duplicate' : 'dashboard.here') : bp.id === ctx.activeBreakpoint ? tr('dashboard.current') : undefined,
				disabled: here && !copy,
				onselect: () => ctx.transfer(d.id, bp.id, copy)
			};
		})
	}));
}

export function tileMenu(ctx: TileMenuContext, count: number): MenuItem[] {
	return [
		{ label: tr('dashboard.copyTo'), children: transferTargets(ctx, true) },
		{ label: tr('dashboard.moveTo'), children: transferTargets(ctx, false) },
		{ label: tr('dashboard.deleteTiles', { count }), danger: true, onselect: ctx.remove }
	];
}
