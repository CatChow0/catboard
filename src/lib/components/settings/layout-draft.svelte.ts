// Layout settings being edited in Settings: title, service check interval and
// breakpoints (per user), and the grid / navbar of each dashboard x breakpoint
// (shared). Empty grid fields (null) mean "default". Pair changes stay pending
// until Save; the pair on screen is previewed live and restored on Cancel.
import { get } from 'svelte/store';
import { uid } from '$lib/utils/uid';
import type { Breakpoint, Layout, Settings } from '$lib/types';
import { layout, activeBreakpointId, activeDashboardId, fetchDashboardLayout, saveLayoutSettings, GRID_DEFAULTS } from '$lib/stores/dashboard';

export type PairValues = { cellSize: number | null; gap: number | null; navbarColumns: number | null; rowHeight: number | null; marginTop: number | null; marginBottom: number | null };

const EMPTY: PairValues = { cellSize: null, gap: null, navbarColumns: null, rowHeight: null, marginTop: null, marginBottom: null };
const DEFAULT_BREAKPOINTS: Breakpoint[] = [
	{ id: 'mobile', name: 'Mobile', minWidth: 0, columns: 4 },
	{ id: 'tablet', name: 'Tablet', minWidth: 800, columns: 6 },
	{ id: 'desktop', name: 'Desktop', minWidth: 1200, columns: 10 }
];
const pairKey = (d: string, b: string) => `${d}|${b}`;

export class LayoutDraft {
	title = $state('');
	statusCheckInterval = $state(30000);
	breakpoints = $state<Breakpoint[]>([]);

	selDash = $state('');
	selBp = $state('');
	dashLayouts = $state<Record<string, Layout>>({});
	edits = $state<Record<string, PairValues>>({});
	form = $state<PairValues>({ ...EMPTY });
	copiedNotice = $state(false);

	readonly defaultCellSize: number;
	readonly defaultGap: number;
	/** The layout on screen when Settings opened, put back on Cancel. */
	readonly originalLayout: Layout;

	isLivePair = $derived(this.selDash === get(activeDashboardId) && this.selBp === get(activeBreakpointId));
	pendingCount = $derived(Object.keys(this.edits).length);

	constructor(s: Settings) {
		this.title = s.title;
		this.statusCheckInterval = s.statusCheckInterval || 30000;
		this.breakpoints = [...(s.layout?.breakpoints || DEFAULT_BREAKPOINTS)].map((bp, i) => (bp.id ? bp : { ...bp, id: `bp-${bp.minWidth}-${i}` }));
		this.defaultCellSize = s.layout?.cellSize || GRID_DEFAULTS.cellSize;
		this.defaultGap = s.layout?.gap ?? GRID_DEFAULTS.gap;
		const current = get(layout);
		this.originalLayout = JSON.parse(JSON.stringify(current));
		this.selDash = get(activeDashboardId);
		this.selBp = get(activeBreakpointId);
		this.dashLayouts = { [this.selDash]: JSON.parse(JSON.stringify(current)) };
		this.form = this.storedValues(this.selDash, this.selBp);
	}

	isEdited(dashboard: string, breakpoint: string) {
		return !!this.edits[pairKey(dashboard, breakpoint)];
	}

	addBreakpoint() {
		this.breakpoints = [...this.breakpoints, { id: uid(), name: 'New Layout', minWidth: 0, columns: 4 }];
	}

	removeBreakpoint(index: number) {
		if (this.breakpoints.length <= 1) return;
		this.breakpoints = this.breakpoints.filter((_, i) => i !== index);
	}

	private storedValues(d: string, b: string): PairValues {
		const per = this.dashLayouts[d]?.layouts?.[b];
		return {
			cellSize: per?.grid?.cellSize ?? null,
			gap: per?.grid?.gap ?? null,
			navbarColumns: per?.navbar?.columns ?? null,
			rowHeight: per?.navbar?.rowHeight ?? null,
			marginTop: per?.navbar?.marginTop ?? null,
			marginBottom: per?.navbar?.marginBottom ?? null
		};
	}

	async selectPair(d: string, b: string) {
		this.selDash = d;
		this.selBp = b;
		if (!this.dashLayouts[d]) {
			try {
				this.dashLayouts = { ...this.dashLayouts, [d]: await fetchDashboardLayout(d) };
			} catch {
				// keep the defaults
			}
		}
		if (this.selDash === d && this.selBp === b) this.form = { ...(this.edits[pairKey(d, b)] ?? this.storedValues(d, b)) };
	}

	/** Field changed: remember it and preview it when it is the dashboard on screen. */
	changed() {
		this.edits = { ...this.edits, [pairKey(this.selDash, this.selBp)]: { ...this.form } };
		if (this.isLivePair) this.preview(this.selBp, this.form);
	}

	private preview(bp: string, v: PairValues) {
		layout.update((l) => {
			const per = l.layouts[bp];
			if (!per) return l;
			per.grid = { cellSize: v.cellSize ?? undefined, gap: v.gap ?? undefined };
			per.navbar = {
				...per.navbar,
				columns: v.navbarColumns ?? GRID_DEFAULTS.navbarColumns,
				rowHeight: v.rowHeight ?? undefined,
				marginTop: v.marginTop ?? undefined,
				marginBottom: v.marginBottom ?? undefined
			};
			return l;
		});
	}

	resetPair() {
		this.form = { ...EMPTY };
		this.changed();
	}

	/** Same values for every breakpoint of the selected dashboard. */
	copyToAllBreakpoints() {
		const next = { ...this.edits };
		for (const bp of this.breakpoints) next[pairKey(this.selDash, bp.id)] = { ...this.form };
		this.edits = next;
		if (this.selDash === get(activeDashboardId)) this.preview(get(activeBreakpointId), this.form);
		this.copiedNotice = true;
		setTimeout(() => (this.copiedNotice = false), 1800);
	}

	/** Per-user fields, merged into the saved settings. */
	values() {
		return {
			title: this.title,
			statusCheckInterval: this.statusCheckInterval,
			layout: { cellSize: this.defaultCellSize, gap: this.defaultGap, breakpoints: $state.snapshot(this.breakpoints) }
		};
	}

	/** Saves the changed dashboard x breakpoint layouts. */
	async saveEdits() {
		for (const [key, v] of Object.entries(this.edits)) {
			const [d, b] = key.split('|');
			await saveLayoutSettings(d, b, {
				cellSize: v.cellSize ?? undefined,
				gap: v.gap ?? undefined,
				navbarColumns: v.navbarColumns ?? GRID_DEFAULTS.navbarColumns,
				rowHeight: v.rowHeight ?? undefined,
				marginTop: v.marginTop ?? undefined,
				marginBottom: v.marginBottom ?? undefined
			});
		}
	}
}
