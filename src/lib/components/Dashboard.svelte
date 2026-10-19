<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import DashboardItem from './DashboardItem.svelte';
	import Navbar from './Navbar.svelte';
	import {
		services,
		layout,
		settings,
		isEditing,
		activeBreakpointId,
		manualBreakpointId,
		removeDashboardItem,
		commitLayout,
		resolveActiveBreakpointId,
		getBreakpointLabel,
		searchQuery,
		dashboards,
		activeDashboardId,
		dashboardDirection,
		activeGrid,
		highlightItem,
		dashboardSwitchBlocked,
		switchDashboard,
		followDashboardHash,
		transferItems,
		settingsRequest
	} from '$lib/stores/dashboard';
	import { isPhone } from '$lib/stores/viewport';
	import MobileEditBar from './MobileEditBar.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import { matchingItemIds } from '$lib/utils/search';
	import type { Service, DashboardItem as DashboardItemType, Layout } from '$lib/stores/dashboard';
	import {
		moveWithPush,
		swapInto,
		resizeWithPush,
		gridMetrics,
		cellAt,
		groupNextPosition,
		groupBounds,
		type Placed,
		type Bounds,
		type GridMetrics
	} from '$lib/utils/grid';
	import { flipOnMove } from '$lib/utils/flip';
	import { swipeDirection } from '$lib/utils/swipe';
	import { tileMenu } from './dashboard/tile-menu';

	let showAddPopup = $state(false);
	let showSettings = $state(false);
	// Tab asked by another dialog (openSettings), e.g. the widget catalog's "Set up".
	let settingsAt = $state<{ tab: 'integrations'; integration?: string } | null>(null);
	$effect(() => {
		const req = $settingsRequest;
		if (!req) return;
		settingsAt = req;
		showSettings = true;
		settingsRequest.set(null);
	});
	let editingService = $state<Service | null>(null);
	let windowWidth = $state(1200);

	// Columns of the active breakpoint; cell height and gap of this dashboard at that breakpoint.
	let columns = $derived($activeGrid.columns);
	let cellSize = $derived($activeGrid.cellSize);
	let gap = $derived($activeGrid.gap);

	let gridEl: HTMLElement | undefined = $state();
	let selectedItemIds = $state<Set<string>>(new Set());
	let selectedChildIds = $state<Map<string, Set<string>>>(new Map());

	$effect(() => {
		if (!$isEditing) {
			selectedItemIds = new Set();
			selectedChildIds = new Map();
		}
	});

	let activeBreakpointIdValue = $derived($activeBreakpointId);
	let activeLayout = $derived($layout?.layouts?.[activeBreakpointIdValue] || { items: [], navbar: { columns: 12, items: [] } });
	let items = $derived(activeLayout.items || []);

	let query = $derived($searchQuery.trim().toLowerCase());

	let matchingIds = $derived(query ? matchingItemIds(items, query, $services) : new Set<string>());

	// Update active breakpoint when window width changes (unless manually overridden)
	$effect(() => {
		const bpId = resolveActiveBreakpointId(
			$layout?.grid?.breakpoints || [],
			windowWidth,
			$manualBreakpointId
		);
		if (bpId !== $activeBreakpointId) {
			activeBreakpointId.set(bpId);
		}
	});

	// =========================================================================
	// Edit-mode drag & drop
	//
	// A drag starts after a small movement (clicks never save). The dragged tile
	// follows the pointer (CSS translate from its original cell) while the
	// target cell is computed from the tile's top-left corner, so the grab
	// offset is respected. Tiles in the way are pushed down (moveWithPush);
	// inside a group, which keeps its size, a push that would overflow falls
	// back to swapping the two tiles. Every preview is computed from the layout
	// as it was when the drag started, so moving back undoes the pushes.
	// Containers: null = the root grid, otherwise a group id.
	// =========================================================================

	type Rect = { col: number; row: number; colSpan: number; rowSpan: number };
	type Container = string | null;

	const THRESHOLD = 5; // px of movement before a press becomes a drag
	const HOLD_MS = 300; // touch: hold this long before a tile lifts (moving earlier scrolls)
	const LEAVE_MARGIN = 24; // px a tile must travel outside its group to leave it
	const EDGE = 60; // px from the window edge where auto-scroll starts

	let pending: {
		pointerId: number;
		x: number;
		y: number;
		anchor: DashboardItemType;
		ids: string[];
		source: Container;
		el: HTMLElement;
		/** Element pressed (the context menu opens for it on a touch hold-and-release). */
		target: HTMLElement;
		touch: boolean;
		/** Touch presses arm after HOLD_MS; mouse presses are armed at once. */
		armed: boolean;
		timer: ReturnType<typeof setTimeout> | undefined;
	} | null = null;

	/** Tile lifted by a touch hold, drawn raised until it is dragged or released. */
	let liftedId = $state<string | null>(null);

	let drag = $state<{
		ids: string[];
		anchorId: string;
		source: Container;
		target: Container;
		grabX: number;
		grabY: number;
		startX: number;
		startY: number;
		startScrollX: number;
		startScrollY: number;
		dx: number;
		dy: number;
		origin: Map<string, Rect>; // dragged tiles, in source-container cells
		preview: Map<string, Rect> | null; // every tile of the target container
		collapsedTarget: boolean; // dropping onto a collapsed group: append
		hasGroup: boolean; // groups can't be dropped into groups
		// Tiles dragged out of a group are drawn as a floating copy (a scrolling
		// group would clip the tile itself); clientDx/Dy move it with the pointer.
		avatar: { item: DashboardItemType; left: number; top: number; width: number; height: number } | null;
		clientDx: number;
		clientDy: number;
	} | null>(null);

	let resize = $state<{
		id: string;
		startX: number;
		startY: number;
		startColSpan: number;
		startRowSpan: number;
		colSpan: number;
		rowSpan: number;
		preview: Map<string, Rect> | null;
	} | null>(null);

	let lastPointer = { x: 0, y: 0 };
	let scrollRaf = 0;

	const rectOf = (i: DashboardItemType): Rect => ({ col: i.col, row: i.row, colSpan: i.colSpan, rowSpan: i.rowSpan });
	const placed = (i: DashboardItemType): Placed => ({ id: i.id, ...rectOf(i) });
	const isGroupItem = (i: DashboardItemType) => i.type === 'group-collapsible' || i.type === 'group-standard';
	const sameRect = (a: Rect, b: Rect) => a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;
	const gridPos = (r: Rect) => `grid-column: ${r.col + 1} / span ${r.colSpan}; grid-row: ${r.row + 1} / span ${r.rowSpan};`;
	const inside = (r: DOMRect, x: number, y: number, m = 0) => x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;

	function containerItems(c: Container): DashboardItemType[] {
		if (c === null) return items;
		const g = items.find((i) => i.id === c);
		return g && 'children' in g ? g.children : [];
	}

	function groupEl(id: string): HTMLElement | null {
		return document.querySelector(`[data-group-id="${CSS.escape(id)}"]`);
	}

	function groupGridEl(id: string): HTMLElement | null {
		return document.querySelector(`[data-group-id="${CSS.escape(id)}"] .group-grid`);
	}

	/** The element that scrolls a group's content (also clips it when the group scrolls). */
	function groupScrollEl(id: string): HTMLElement | null {
		return document.querySelector(`[data-group-id="${CSS.escape(id)}"] .group-scroll`);
	}

	function boundsOf(c: Container): Bounds {
		if (c === null) return { cols: columns };
		const g = items.find((i) => i.id === c);
		return g && 'children' in g ? groupBounds(g) : { cols: 1, rows: 1 };
	}

	/**
	 * Page rect of a root group at its stored position. While the root preview
	 * pushes tiles, a group may be drawn lower than where it really is; hit
	 * tests use this stable rect so approaching a group doesn't push it away.
	 */
	function groupHomeRect(id: string): DOMRect | null {
		const g = items.find((i) => i.id === id);
		const el = groupEl(id);
		if (!g || !el || !gridEl) return null;
		const m = gridMetrics(gridEl.getBoundingClientRect(), columns, gap, { cellSize });
		const now = el.getBoundingClientRect();
		const left = m.left + g.col * m.colStep;
		const top = m.top + g.row * m.rowStep;
		// Collapsed groups are only as tall as their header.
		const height = groupGridEl(id) ? g.rowSpan * m.rowStep - gap : now.height;
		return new DOMRect(left, top, g.colSpan * m.colStep - gap, height);
	}

	/** The group's inner grid rect, moved to the group's stored position. */
	function groupGridHomeRect(id: string): DOMRect | null {
		const home = groupHomeRect(id);
		const el = groupEl(id);
		const grid = groupGridEl(id);
		if (!home || !el || !grid) return null;
		const now = el.getBoundingClientRect();
		const r = grid.getBoundingClientRect();
		return new DOMRect(r.left + home.left - now.left, r.top + home.top - now.top, r.width, r.height);
	}

	/** Visible part of a group's content (its scroll viewport), at the group's stored position. */
	function groupViewHomeRect(id: string): DOMRect | null {
		const home = groupHomeRect(id);
		const el = groupEl(id);
		const view = groupScrollEl(id);
		if (!home || !el || !view) return null;
		const now = el.getBoundingClientRect();
		const r = view.getBoundingClientRect();
		return new DOMRect(r.left + home.left - now.left, r.top + home.top - now.top, r.width, r.height);
	}

	function metricsOf(c: Container): GridMetrics | null {
		if (c === null) return gridEl ? gridMetrics(gridEl.getBoundingClientRect(), columns, gap, { cellSize }) : null;
		const g = items.find((i) => i.id === c);
		const r = groupGridHomeRect(c);
		if (!g || !r) return null;
		// The group grid publishes its cell size, which stays right when its
		// content is scrolled or larger than the group (scrolling groups).
		const cell = groupGridEl(c)?.dataset;
		const cw = Number(cell?.cellW);
		const ch = Number(cell?.cellH);
		if (cw > 0 && ch > 0) return { left: r.left + gap, top: r.top + gap, colStep: cw + gap, rowStep: ch + gap };
		return gridMetrics(r, g.colSpan, gap, { pad: gap, rows: g.rowSpan });
	}

	// --- Starting a drag ------------------------------------------------------

	function beginPointer(e: PointerEvent, item: DashboardItemType, source: Container) {
		const selection = source === null ? selectedItemIds : (selectedChildIds.get(source) ?? new Set<string>());
		const ids = selection.has(item.id) && selection.size > 1 ? [item.id, ...[...selection].filter((id) => id !== item.id)] : [item.id];
		const touch = e.pointerType === 'touch';
		clearPending();
		pending = {
			pointerId: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			anchor: item,
			ids,
			source,
			el: e.currentTarget as HTMLElement,
			target: e.target as HTMLElement,
			touch,
			armed: !touch,
			timer: undefined
		};
		if (touch) pending.timer = setTimeout(armPending, HOLD_MS);
	}

	/** Touch hold reached: the tile lifts; moving now drags it, releasing opens its menu. */
	function armPending() {
		if (!pending) return;
		pending.armed = true;
		liftedId = pending.anchor.id;
		navigator.vibrate?.(12);
	}

	function clearPending() {
		if (pending) clearTimeout(pending.timer);
		pending = null;
		liftedId = null;
	}

	/** While a tile is lifted or dragged by touch, the page must not scroll. */
	function blockTouchScroll(e: TouchEvent) {
		if ((pending?.armed && pending.touch) || drag || resize) e.preventDefault();
	}

	function handlePointerDownOnItem(e: PointerEvent, item: DashboardItemType) {
		if (!$isEditing || e.button !== 0) return;
		selectedChildIds = new Map();
		if (resize || drag) return;
		const target = e.target as HTMLElement;
		if (target.closest('.resize-handle, .btn-edit, .btn-delete, .modal-overlay, .edit-modal, input, select, textarea')) return;
		if (target.closest('.child-wrapper')) return;

		const isGroup = isGroupItem(item);
		if (e.shiftKey || e.ctrlKey || e.metaKey) {
			e.preventDefault();
			if (!isGroup) {
				const next = new Set(selectedItemIds);
				if (next.has(item.id)) next.delete(item.id);
				else next.add(item.id);
				selectedItemIds = next;
			}
			return;
		}
		if (!selectedItemIds.has(item.id)) selectedItemIds = new Set(isGroup ? [] : [item.id]);
		e.preventDefault();
		beginPointer(e, item, null);
	}

	function toggleChildSelection(groupId: string, childId: string, multiSelect: boolean) {
		const current = selectedChildIds.get(groupId) || new Set<string>();
		const next = new Set(current);
		if (multiSelect) {
			if (next.has(childId)) next.delete(childId);
			else next.add(childId);
		} else if (next.size === 1 && next.has(childId)) {
			next.clear();
		} else {
			next.clear();
			next.add(childId);
		}
		const map = new Map(selectedChildIds);
		if (next.size === 0) map.delete(groupId);
		else map.set(groupId, next);
		selectedChildIds = map;
	}

	function handleDragChildFromGroup(e: PointerEvent, child: DashboardItemType) {
		if (!$isEditing || e.button !== 0 || resize || drag) return;
		const target = e.target as HTMLElement;
		if (target.closest('.resize-handle, .btn-edit, .btn-delete, .modal-overlay, .edit-modal, input, select, textarea')) return;
		const groupId = (target.closest('[data-group-id]') as HTMLElement | null)?.dataset.groupId;
		if (!groupId) return;
		e.preventDefault();
		e.stopPropagation();

		if (e.shiftKey || e.ctrlKey || e.metaKey) {
			toggleChildSelection(groupId, child.id, true);
			return;
		}
		selectedItemIds = new Set();
		const inGroup = selectedChildIds.get(groupId);
		if (!inGroup?.has(child.id)) selectedChildIds = new Map([[groupId, new Set([child.id])]]);
		else selectedChildIds = new Map([[groupId, inGroup]]);
		beginPointer(e, child, groupId);
	}

	function startDrag() {
		const pd = pending!;
		clearPending();
		const list = containerItems(pd.source);
		const origin = new Map<string, Rect>();
		let hasGroup = false;
		for (const id of pd.ids) {
			const it = list.find((i) => i.id === id);
			if (!it) continue;
			origin.set(id, rectOf(it));
			if (isGroupItem(it)) hasGroup = true;
		}
		if (!origin.has(pd.anchor.id)) return;
		const r = pd.el.getBoundingClientRect();
		drag = {
			ids: [...origin.keys()],
			anchorId: pd.anchor.id,
			source: pd.source,
			target: pd.source,
			grabX: pd.x - r.left,
			grabY: pd.y - r.top,
			startX: pd.x,
			startY: pd.y,
			startScrollX: window.scrollX,
			startScrollY: window.scrollY,
			dx: 0,
			dy: 0,
			origin,
			preview: null,
			collapsedTarget: false,
			hasGroup,
			avatar: pd.source !== null ? { item: pd.anchor, left: r.left, top: r.top, width: r.width, height: r.height } : null,
			clientDx: 0,
			clientDy: 0
		};
		dashboardSwitchBlocked.set(true);
		try {
			gridEl?.setPointerCapture(pd.pointerId);
		} catch {
			// pointer already released
		}
		updateDrag();
		scrollRaf = requestAnimationFrame(autoScroll);
	}

	// --- During a drag ----------------------------------------------------------

	/** Width in columns of the dragged selection (anchor-relative bounding box). */
	function blockSpan(d: NonNullable<typeof drag>) {
		const a = d.origin.get(d.anchorId)!;
		let minC = 0, maxC = 0, minR = 0, maxR = 0;
		for (const r of d.origin.values()) {
			minC = Math.min(minC, r.col - a.col);
			maxC = Math.max(maxC, r.col - a.col + r.colSpan);
			minR = Math.min(minR, r.row - a.row);
			maxR = Math.max(maxR, r.row - a.row + r.rowSpan);
		}
		return { minC, maxC, minR, maxR, width: maxC - minC };
	}

	function pickTarget(d: NonNullable<typeof drag>, x: number, y: number): Container {
		// Hysteresis: a tile only leaves its group once clearly outside it.
		if (d.source !== null) {
			const home = groupHomeRect(d.source);
			if (home && inside(home, x, y, LEAVE_MARGIN)) return d.source;
		}
		if (!d.hasGroup) {
			const width = blockSpan(d).width;
			for (const g of items) {
				if (!isGroupItem(g) || !('children' in g) || g.id === d.source || width > groupBounds(g).cols) continue;
				// Only the visible content area counts (headers and borders don't), so
				// tiles can be dragged past a group; a collapsed group accepts drops on itself.
				const zone = groupViewHomeRect(g.id) ?? groupHomeRect(g.id);
				if (zone && inside(zone, x, y)) return g.id;
			}
		}
		return null;
	}

	function updateDrag() {
		const d = drag;
		if (!d) return;
		const { x, y } = lastPointer;
		d.dx = x - d.startX + (window.scrollX - d.startScrollX);
		d.dy = y - d.startY + (window.scrollY - d.startScrollY);
		d.clientDx = x - d.startX;
		d.clientDy = y - d.startY;

		const target = pickTarget(d, x, y);
		if (target !== null && !groupGridEl(target)) {
			d.target = target;
			d.collapsedTarget = true;
			d.preview = null;
			return;
		}
		d.collapsedTarget = false;
		const m = metricsOf(target);
		if (!m) return;
		const bounds = boundsOf(target);
		const span = blockSpan(d);
		const anchor = d.origin.get(d.anchorId)!;

		const cell = cellAt(m, x - d.grabX, y - d.grabY);
		const fitsWidth = span.width <= bounds.cols;
		const fitsHeight = bounds.rows == null || span.maxR - span.minR <= bounds.rows;
		let next: Map<string, Rect> | null = null;
		if (fitsWidth && fitsHeight) {
			let col = Math.max(-span.minC, Math.min(cell.col, bounds.cols - span.maxC));
			let row = Math.max(-span.minR, cell.row);
			if (bounds.rows != null) row = Math.min(row, bounds.rows - span.maxR);
			const moved = new Map<string, Rect>();
			for (const [id, r] of d.origin) {
				moved.set(id, { col: col + r.col - anchor.col, row: row + r.row - anchor.row, colSpan: r.colSpan, rowSpan: r.rowSpan });
			}
			const others = containerItems(target).filter((i) => !d.origin.has(i.id)).map(placed);
			next = moveWithPush(others, moved, bounds);
			// Full group: trade places instead of refusing the move.
			if (!next && target !== null && target === d.source && d.origin.size === 1) {
				next = swapInto(containerItems(target).map(placed), d.anchorId, moved.get(d.anchorId)!, anchor, bounds);
			}
		}
		if (next) {
			d.target = target;
			d.preview = next;
		} else if (d.target !== target) {
			// New container but no valid spot (yet): nothing would happen on drop.
			d.target = target;
			d.preview = null;
		}
	}

	const GROUP_EDGE = 28; // px inside a scrolling group's edge where it auto-scrolls

	function autoScroll() {
		if (!drag) return;
		const { x, y } = lastPointer;
		let moved = false;
		let v = 0;
		if (y < EDGE) v = -((EDGE - y) / EDGE) * 18;
		else if (y > window.innerHeight - EDGE) v = ((y - (window.innerHeight - EDGE)) / EDGE) * 18;
		if (v) {
			window.scrollBy(0, v);
			moved = true;
		}
		// Scrolling group under the pointer: scroll its content near the edges so
		// tiles can be dropped beyond what is visible.
		const sc = drag.target !== null ? groupScrollEl(drag.target) : null;
		if (sc && (sc.scrollHeight > sc.clientHeight || sc.scrollWidth > sc.clientWidth)) {
			const r = sc.getBoundingClientRect();
			const step = (d: number) => ((GROUP_EDGE - d) / GROUP_EDGE) * 10;
			const before = sc.scrollTop + sc.scrollLeft;
			if (sc.scrollHeight > sc.clientHeight) {
				if (y - r.top < GROUP_EDGE) sc.scrollTop -= step(y - r.top);
				else if (r.bottom - y < GROUP_EDGE) sc.scrollTop += step(r.bottom - y);
			}
			if (sc.scrollWidth > sc.clientWidth) {
				if (x - r.left < GROUP_EDGE) sc.scrollLeft -= step(x - r.left);
				else if (r.right - x < GROUP_EDGE) sc.scrollLeft += step(r.right - x);
			}
			if (sc.scrollTop + sc.scrollLeft !== before) moved = true;
		}
		if (moved) updateDrag();
		scrollRaf = requestAnimationFrame(autoScroll);
	}

	// --- Ending a drag ----------------------------------------------------------

	/** A drag ends with a click on whatever is under the pointer; eat it. */
	function swallowClick() {
		const eat = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
		};
		window.addEventListener('click', eat, { capture: true, once: true });
		setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 0);
	}

	function endDrag() {
		cancelAnimationFrame(scrollRaf);
		drag = null;
		dashboardSwitchBlocked.set(false);
		swallowClick();
	}

	function finishDrag() {
		const d = drag;
		endDrag();
		if (!d) return;


		const next: Layout = JSON.parse(JSON.stringify($layout)) as Layout;
		const bp = next.layouts[activeBreakpointIdValue];
		if (!bp) return;
		const listOf = (c: Container): DashboardItemType[] => {
			if (c === null) return bp.items;
			const g = bp.items.find((i) => i.id === c);
			return g && 'children' in g ? g.children : [];
		};
		const source = listOf(d.source);
		const moving = source.filter((i) => d.origin.has(i.id));

		let positions = d.preview;
		if (d.collapsedTarget && d.target !== null) {
			// Append into the collapsed group's first free spots, or refuse.
			const g = bp.items.find((i) => i.id === d.target)!;
			const kids = [...listOf(d.target)];
			// Scrolling groups always have room along their axis; fixed ones may be full.
			if (!('children' in g)) return;
			positions = new Map();
			for (const it of moving) {
				const p = groupNextPosition(g, kids, it.colSpan, it.rowSpan);
				if (!p) return;
				positions.set(it.id, { ...rectOf(it), col: p.col, row: p.row });
				kids.push({ ...it, col: p.col, row: p.row });
			}
		}
		if (!positions) return;

		if (d.target === d.source && listOf(d.target).every((i) => !positions!.has(i.id) || sameRect(positions!.get(i.id)!, i))) return;

		if (d.target !== d.source) {
			for (const it of moving) source.splice(source.indexOf(it), 1);
			listOf(d.target).push(...moving);
		}
		for (const it of listOf(d.target)) {
			const p = positions.get(it.id);
			if (p) {
				it.col = p.col;
				it.row = p.row;
			}
		}
		commitLayout(next);
	}

	// --- Resizing root tiles ------------------------------------------------------

	function handlePointerDownOnResize(e: PointerEvent, item: DashboardItemType) {
		if (!$isEditing || e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		resize = {
			id: item.id,
			startX: e.clientX,
			startY: e.clientY,
			startColSpan: item.colSpan,
			startRowSpan: item.rowSpan,
			colSpan: item.colSpan,
			rowSpan: item.rowSpan,
			preview: null
		};
		try {
			gridEl?.setPointerCapture(e.pointerId);
		} catch {
			// ignore
		}
	}

	function updateResize() {
		const r = resize;
		const m = metricsOf(null);
		const item = r && items.find((i) => i.id === r.id);
		if (!r || !m || !item) return;
		const colSpan = Math.max(1, Math.min(r.startColSpan + Math.round((lastPointer.x - r.startX) / m.colStep), columns - item.col));
		const rowSpan = Math.max(1, r.startRowSpan + Math.round((lastPointer.y - r.startY) / m.rowStep));
		if (colSpan === r.colSpan && rowSpan === r.rowSpan && r.preview) return;
		const next = resizeWithPush(items.map(placed), r.id, colSpan, rowSpan, { cols: columns });
		if (next) {
			r.colSpan = colSpan;
			r.rowSpan = rowSpan;
			r.preview = next;
		}
	}

	function finishResize() {
		const r = resize;
		resize = null;
		swallowClick();
		if (!r?.preview) return;
		if (r.colSpan === r.startColSpan && r.rowSpan === r.startRowSpan) return;
		const next: Layout = JSON.parse(JSON.stringify($layout)) as Layout;
		const bp = next.layouts[activeBreakpointIdValue];
		if (!bp) return;
		for (const it of bp.items) {
			const p = r.preview.get(it.id);
			if (p) Object.assign(it, { col: p.col, row: p.row, colSpan: p.colSpan, rowSpan: p.rowSpan });
		}
		commitLayout(next);
	}

	// --- Window listeners ---------------------------------------------------------

	function handlePointerMove(e: PointerEvent) {
		lastPointer = { x: e.clientX, y: e.clientY };
		if (pending) {
			if (e.pointerId !== pending.pointerId || Math.hypot(e.clientX - pending.x, e.clientY - pending.y) <= THRESHOLD) return;
			// A finger that moves before the hold completes is scrolling or swiping, not dragging.
			if (pending.armed) startDrag();
			else clearPending();
			return;
		}
		if (drag) updateDrag();
		else if (resize) updateResize();
	}

	function handlePointerUp() {
		if (pending) {
			const pd = pending;
			clearPending();
			// Touch hold released without moving: the tile's menu.
			if (pd.touch && pd.armed) openMenuAt(pd.target, pd.x, pd.y);
		} else if (drag) finishDrag();
		else if (resize) finishResize();
	}

	function cancelAll() {
		clearPending();
		if (drag) endDrag();
		if (resize) {
			resize = null;
			swallowClick();
		}
	}

	function handleGridPointerDown(e: PointerEvent) {
		if (!$isEditing) return;
		if ((e.target as HTMLElement).closest('.item-wrapper')) return;
		selectedItemIds = new Set();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
			// Switch dashboards, unless typing, editing or a dialog is open.
			const t = e.target as HTMLElement | null;
			const typing = !!t?.closest('input, textarea, select, [contenteditable="true"]');
			const modal = showAddPopup || showSettings || !!editingService || !!document.querySelector('[aria-modal="true"], [role="dialog"]');
			if (typing || modal || $isEditing || e.altKey || e.ctrlKey || e.metaKey || $dashboards.length < 2) return;
			e.preventDefault();
			void switchDashboard(e.key === 'ArrowRight' ? 'next' : 'prev');
			return;
		}
		if (e.key !== 'Escape') return;
		if (drag || resize || pending) {
			cancelAll();
			return;
		}
		selectedItemIds = new Set();
		selectedChildIds = new Map();
	}

	// --- Dashboards: touch swipe, slide transition, notices ----------------------

	let swipe: { id: number; x: number; y: number; t: number } | null = null;

	function swipeStart(e: PointerEvent) {
		if (e.pointerType !== 'touch' || $isEditing || $dashboards.length < 2) return;
		swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
	}

	function swipeEnd(e: PointerEvent) {
		const s = swipe;
		swipe = null;
		if (!s || e.pointerId !== s.id) return;
		const dir = swipeDirection(s, { x: e.clientX, y: e.clientY, t: Date.now() });
		if (!dir) return;
		swallowClick();
		void switchDashboard(dir);
	}

	/** Slide the dashboard page in / out horizontally; none when animations are off. */
	function slide(node: HTMLElement, { into }: { into: boolean }) {
		const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
		if ($settings.animations === 'none' || reduced) return { duration: 0 };
		const width = node.parentElement?.clientWidth || window.innerWidth;
		const dir = $dashboardDirection;
		return fly(node, { x: (into ? dir : -dir) * Math.min(width, 900), duration: 300, easing: cubicOut, opacity: 0 });
	}

	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	function showToast(msg: string) {
		toast = msg;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 2600);
	}

	// --- Edit-mode context menu: copy / move to a dashboard x breakpoint, delete ---

	let menu = $state<{ x: number; y: number; ids: string[] } | null>(null);

	/** Ids of every selected tile (root and inside groups). */
	function selectedIds(): string[] {
		return [...selectedItemIds, ...[...selectedChildIds.values()].flatMap((s) => [...s])];
	}

	/** Right-click (or long press) on a tile: select it unless it is already part of the selection. */
	function openMenuAt(target: HTMLElement, x: number, y: number) {
		const child = target.closest('[data-child-id]') as HTMLElement | null;
		const root = target.closest('[data-item-id]') as HTMLElement | null;
		const id = child?.dataset.childId ?? root?.dataset.itemId;
		if (!id) return false;
		if (!selectedIds().includes(id)) {
			if (child) {
				const groupId = (child.closest('[data-group-id]') as HTMLElement | null)?.dataset.groupId ?? '';
				selectedItemIds = new Set();
				selectedChildIds = new Map([[groupId, new Set([id])]]);
			} else {
				selectedChildIds = new Map();
				selectedItemIds = new Set([id]);
			}
		}
		menu = { x, y, ids: selectedIds() };
		return true;
	}

	function handleContextMenu(e: MouseEvent) {
		if (!$isEditing || drag || resize) return;
		if ((e.target as HTMLElement).closest('input, textarea, select, .modal-overlay, .edit-modal')) return;
		if (openMenuAt(e.target as HTMLElement, e.clientX, e.clientY)) e.preventDefault();
	}

	async function runTransfer(ids: string[], to: string, toBp: string, copy: boolean) {
		const dash = $dashboards.find((d) => d.id === to)?.name ?? '';
		const bpName = getBreakpointLabel($layout.grid.breakpoints, toBp);
		try {
			const n = await transferItems(ids, to, toBp, copy);
			selectedItemIds = new Set();
			selectedChildIds = new Map();
			showToast(`${n > 1 ? `${n} tiles` : 'Tile'} ${copy ? 'copied' : 'moved'} to ${dash} · ${bpName}`);
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Failed');
		}
	}

	async function deleteSelection(ids: string[]) {
		if (ids.length > 1 && !confirm(`Delete ${ids.length} tiles?`)) return;
		for (const id of ids) await removeDashboardItem(id);
		selectedItemIds = new Set();
		selectedChildIds = new Map();
	}

	// The menu closes (menu = null) before running an action: actions capture the ids.
	function buildMenu(ids: string[]): MenuItem[] {
		return tileMenu(
			{
				dashboards: $dashboards,
				breakpoints: $layout.grid.breakpoints,
				activeDashboard: $activeDashboardId,
				activeBreakpoint: $activeBreakpointId,
				label: (bp) => getBreakpointLabel($layout.grid.breakpoints, bp),
				transfer: (to, bp, copy) => runTransfer(ids, to, bp, copy),
				remove: () => deleteSelection(ids)
			},
			ids.length
		);
	}

	const menuItems = $derived<MenuItem[]>(menu ? buildMenu(menu.ids) : []);

	// --- Search result picked: scroll to the tile and pulse it once -------------

	$effect(() => {
		const id = $highlightItem;
		if (!id) return;
		// Wait for the dashboard slide to render the tile.
		const timer = setTimeout(() => {
			const el =
				(document.querySelector(`.dashboard-page:last-child [data-child-id="${CSS.escape(id)}"]`) as HTMLElement | null) ??
				(document.querySelector(`.dashboard-page:last-child [data-item-id="${CSS.escape(id)}"]`) as HTMLElement | null);
			// A tile inside a collapsed group is not rendered: point at the group instead.
			const target = el ?? (findGroupOf(id) ? (document.querySelector(`[data-group-id="${CSS.escape(findGroupOf(id)!)}"]`) as HTMLElement | null) : null);
			if (!target) return;
			target.scrollIntoView({ block: 'center', behavior: $settings.animations === 'none' ? 'auto' : 'smooth' });
			target.animate(
				[
					{ boxShadow: '0 0 0 0 color-mix(in srgb, var(--accent) 70%, transparent)', scale: '1' },
					{ boxShadow: '0 0 0 6px color-mix(in srgb, var(--accent) 45%, transparent)', scale: '1.03' },
					{ boxShadow: '0 0 0 0 transparent', scale: '1' }
				],
				{ duration: 900, iterations: 2, easing: 'ease-out' }
			);
			highlightItem.set(null);
		}, 360);
		return () => clearTimeout(timer);
	});

	function findGroupOf(childId: string): string | null {
		for (const it of items) if ('children' in it && it.children.some((c) => c.id === childId)) return it.id;
		return null;
	}

	// --- Rendering helpers ---------------------------------------------------------

	const isDragged = (id: string, container: Container) => !!drag && drag.source === container && drag.origin.has(id);

	function itemRect(item: DashboardItemType): Rect {
		if (resize?.preview?.has(item.id)) return resize.preview.get(item.id)!;
		if (drag && !isDragged(item.id, null) && drag.target === null && drag.preview?.has(item.id)) return drag.preview.get(item.id)!;
		return rectOf(item);
	}

	function getItemStyle(item: DashboardItemType): string {
		const pos = gridPos(itemRect(item));
		return isDragged(item.id, null) && drag ? `${pos} transform: translate(${drag.dx}px, ${drag.dy}px);` : pos;
	}

	const rootPlaceholders = $derived(
		drag && drag.target === null && drag.preview ? drag.ids.map((id) => drag!.preview!.get(id)).filter((r): r is Rect => !!r) : []
	);

	/** What a group needs to draw the drag: its ghosts, previewed children and placeholders. */
	function dragViewFor(groupId: string) {
		if (!drag || (drag.source !== groupId && drag.target !== groupId)) return null;
		const isTarget = drag.target === groupId && !drag.collapsedTarget;
		return {
			ghostIds: drag.source === groupId ? new Set(drag.origin.keys()) : new Set<string>(),
			preview: isTarget ? drag.preview : null,
			placeholders: isTarget && drag.preview ? drag.ids.map((id) => drag!.preview!.get(id)).filter((r): r is Rect => !!r) : []
		};
	}

	onMount(() => {
		windowWidth = window.innerWidth;
		const onResize = () => { windowWidth = window.innerWidth; };
		window.addEventListener('resize', onResize);
		// Back / forward or an edited #name in the address bar.
		window.addEventListener('hashchange', followDashboardHash);
		// Non-passive so a lifted tile can stop the page from scrolling.
		window.addEventListener('touchmove', blockTouchScroll, { passive: false });
		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('hashchange', followDashboardHash);
			cancelAnimationFrame(scrollRaf);
			clearTimeout(toastTimer);
			clearPending();
			window.removeEventListener('touchmove', blockTouchScroll);
		};
	});

	async function handleRemoveItem(itemId: string) {
		await removeDashboardItem(itemId);
	}

	async function handleEditService(service: Service) {
		editingService = service;
	}

	async function handleLogout() {
		await fetch("/api/auth/logout", { method: "POST" });
		window.location.href = "/login";
	}

</script>
<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} onpointercancel={cancelAll} onkeydown={handleKeyDown} />

<div
	class="dashboard-wrapper"
	class:edit-mode={$isEditing}
	class:dragging={!!drag}
	class:resizing={!!resize}
	class:phone-editing={$isPhone && $isEditing}
>
	<Navbar onadd={() => (showAddPopup = true)} onsettings={() => (showSettings = true)} onlogout={handleLogout} />

	<main class="dashboard-grid-wrapper" onpointerdown={swipeStart} onpointerup={swipeEnd} onpointercancel={() => (swipe = null)}>
		<!-- One page per dashboard: switching slides the old page out and the new one in
		     (both share the same grid cell while the transition runs). -->
		<div class="dashboard-pages">
			{#key $activeDashboardId}
				<div class="dashboard-page" in:slide={{ into: true }} out:slide={{ into: false }}>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						bind:this={gridEl}
						class="dashboard-grid"
						style="grid-template-columns: repeat({columns}, 1fr); grid-auto-rows: {cellSize}px; gap: {gap}px;"
						onpointerdown={handleGridPointerDown}
						oncontextmenu={handleContextMenu}
					>
						{#each items as item (item.id)}
							{@const r = itemRect(item)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="item-wrapper"
								data-item-id={item.id}
								class:editing={$isEditing}
								class:dragging={isDragged(item.id, null)}
								class:drag-source={drag?.source === item.id}
								class:selected={selectedItemIds.has(item.id) && !drag}
								class:lifted={liftedId === item.id}
								class:drop-target={drag?.target === item.id && drag?.source !== item.id}
								class:drop-refused={drag?.target === item.id && drag?.source !== item.id && !drag?.preview && !drag?.collapsedTarget}
								class:dimmed={query && !matchingIds.has(item.id)}
								class:highlighted={query && matchingIds.has(item.id)}
								style={getItemStyle(item)}
								use:flipOnMove={{ key: `${r.col},${r.row},${r.colSpan},${r.rowSpan}`, animate: !!(drag || resize) && !isDragged(item.id, null) }}
								onpointerdown={(e) => handlePointerDownOnItem(e, item)}
							>
								<DashboardItem
									{item}
									allServices={$services}
									effectiveColSpan={r.colSpan}
									effectiveRowSpan={r.rowSpan}
									gridGap={gap}
									onedit={handleEditService}
									onremove={handleRemoveItem}
									ondragitem={handleDragChildFromGroup}
									dragView={dragViewFor(item.id)}
									selectedChildIds={selectedChildIds.get(item.id)}
									ontogglechild={toggleChildSelection}
									{query}
									{matchingIds}
								/>
								{#if $isEditing}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="resize-handle"
										onpointerdown={(e) => handlePointerDownOnResize(e, item)}
									></div>
								{/if}
							</div>
						{/each}

						{#each rootPlaceholders as p, i (i)}
							<div class="drag-placeholder" style={gridPos(p)}></div>
						{/each}
					</div>

					{#if items.length === 0}
						<div class="empty-state">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<rect x="3" y="3" width="7" height="7" rx="1" />
								<rect x="14" y="3" width="7" height="7" rx="1" />
								<rect x="3" y="14" width="7" height="7" rx="1" />
								<rect x="14" y="14" width="7" height="7" rx="1" />
							</svg>
							<p>Ce layout est vide</p>
							<p class="hint">Ajoutez des services et widgets via le bouton + pour le format {getBreakpointLabel($layout.grid.breakpoints, $activeBreakpointId)}</p>
						</div>
					{/if}
				</div>
			{/key}
		</div>

		{#if drag?.avatar}
			<!-- Floating copy of a tile dragged out of a group (scrolling groups clip their content). -->
			<div
				class="drag-avatar"
				style="left: {drag.avatar.left + drag.clientDx}px; top: {drag.avatar.top + drag.clientDy}px; width: {drag.avatar.width}px; height: {drag.avatar.height}px;"
				aria-hidden="true"
			>
				<DashboardItem item={drag.avatar.item} allServices={$services} gridGap={gap} />
				{#if drag.ids.length > 1}<span class="drag-count">{drag.ids.length}</span>{/if}
			</div>
		{/if}

		{#if toast}
			<div class="dash-toast" role="status">{toast}</div>
		{/if}

		{#if menu}
			<ContextMenu x={menu.x} y={menu.y} title={menu.ids.length > 1 ? `${menu.ids.length} selected tiles` : '1 selected tile'} items={menuItems} onclose={() => (menu = null)} />
		{/if}
	</main>
</div>

{#if $isPhone && $isEditing}
	<MobileEditBar onadd={() => (showAddPopup = true)} />
{/if}

<!-- Popups load their code when first opened. -->
{#if showAddPopup}
	{#await import('./AddPopup.svelte') then { default: AddPopup }}
		<AddPopup onclose={() => (showAddPopup = false)} />
	{/await}
{/if}
{#if showSettings}
	{#await import('./SettingsModal.svelte') then { default: SettingsModal }}
		<SettingsModal
			onclose={() => {
				showSettings = false;
				settingsAt = null;
			}}
			initialTab={settingsAt?.tab}
			initialIntegration={settingsAt?.integration}
		/>
	{/await}
{/if}

{#if editingService}
	{#await import('./ServiceModal.svelte') then { default: ServiceModal }}
		<ServiceModal service={editingService} onsave={async (data) => {
			const { updateService } = await import('$lib/stores/dashboard');
			await updateService(editingService!.id, data);
			editingService = null;
		}} onclose={() => (editingService = null)} />
	{/await}
{/if}

<style>
	.dashboard-wrapper {
		min-height: 100vh;
	}

	/* Room for the bottom edit bar. */
	.dashboard-wrapper.phone-editing {
		padding-bottom: calc(72px + env(safe-area-inset-bottom));
	}

	.dashboard-wrapper.dragging,
	.dashboard-wrapper.resizing {
		user-select: none;
	}

	.dashboard-wrapper.dragging :global(a),
	.dashboard-wrapper.resizing :global(a) {
		pointer-events: none;
	}

	.dashboard-grid-wrapper {
		padding: 16px;
		padding-left: max(16px, env(safe-area-inset-left));
		padding-right: max(16px, env(safe-area-inset-right));
	}

	/* Horizontal swipes are ours (dashboard switch); vertical ones scroll the page. */
	.dashboard-wrapper:not(.edit-mode) .dashboard-grid-wrapper {
		touch-action: pan-y;
	}

	/* Old and new dashboard pages overlap in one cell while sliding; clip the
	   part that slides past the side (vertical overflow stays visible). */
	.dashboard-pages {
		display: grid;
		overflow-x: clip;
	}

	.dashboard-page {
		grid-area: 1 / 1;
		min-width: 0;
	}

	.dashboard-grid {
		display: grid;
		width: 100%;
	}

	.dash-toast {
		position: fixed;
		left: 50%;
		bottom: 24px;
		translate: -50% 0;
		z-index: 1100;
		padding: 9px 16px;
		border-radius: var(--radius);
		background: var(--bg-modal);
		border: 1px solid var(--border);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		font-size: 0.85rem;
		color: var(--text-primary);
		animation: toast-in 0.2s ease;
	}

	@keyframes toast-in {
		from { opacity: 0; translate: -50% 8px; }
		to { opacity: 1; translate: -50% 0; }
	}

	.item-wrapper {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: visible;
	}

	.item-wrapper.editing {
		cursor: grab;
		outline: 1px dashed var(--border-light);
		outline-offset: -1px;
		border-radius: var(--radius);
		/* Vertical swipes still scroll the page in edit mode; a touch drag starts
		   after a hold (see HOLD_MS), which then blocks scrolling itself. */
		touch-action: pan-y;
	}

	/* Touch hold reached: the tile lifts to show it can be dragged. */
	.item-wrapper.lifted {
		z-index: 20;
		transform: scale(1.03);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
		transition: transform 0.12s ease, box-shadow 0.12s ease;
	}

	.item-wrapper.editing:active {
		cursor: grabbing;
	}

	/* The dragged tile follows the pointer above everything else. */
	.item-wrapper.dragging {
		z-index: 30;
		opacity: 0.85;
		pointer-events: none;
		filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.35));
	}

	/* A group whose child is being dragged sits above its siblings so the ghost isn't hidden. */
	.item-wrapper.drag-source {
		z-index: 20;
	}

	.dashboard-wrapper.dragging {
		cursor: grabbing;
	}

	.item-wrapper.drop-target {
		outline: 2px solid var(--accent) !important;
		outline-offset: -2px;
	}

	.item-wrapper.drop-refused {
		outline-color: var(--danger) !important;
	}

	.item-wrapper.selected {
		outline: 3px solid var(--accent);
		outline-offset: -3px;
		border-radius: var(--radius);
		z-index: 1;
		box-shadow: 0 0 0 3px var(--accent), 0 0 12px var(--accent-glow);
		background: var(--accent-bg);
		animation: select-pulse 2s ease-in-out infinite;
	}

	.item-wrapper.dragging.selected {
		background: var(--accent-bg);
	}

	@keyframes select-pulse {
		0%, 100% { box-shadow: 0 0 0 3px var(--accent), 0 0 12px var(--accent-glow); }
		50% { box-shadow: 0 0 0 4px var(--accent), 0 0 20px var(--accent-glow); }
	}

	.item-wrapper.drop-target :global(.group) {
		background: var(--accent-bg);
	}

	.dimmed {
		opacity: 0.35;
		filter: grayscale(0.7);
		transition: opacity var(--transition), filter var(--transition);
	}

	.highlighted {
		outline: 2px solid #f1c40f;
		outline-offset: -2px;
		border-radius: var(--radius);
		z-index: 2;
	}

	.resize-handle {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 20px;
		height: 20px;
		cursor: nwse-resize;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
		touch-action: none;
	}

	/* No hover on touch screens (or phones): a bigger handle that is always shown. */
	@media (pointer: coarse), (max-width: 640px) {
		.resize-handle {
			width: 30px;
			height: 30px;
			opacity: 1;
		}

		.resize-handle::after {
			width: 12px;
			height: 12px;
			border-width: 3px;
		}
	}

	.item-wrapper:hover .resize-handle {
		opacity: 1;
	}

	.resize-handle::after {
		content: '';
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 10px;
		height: 10px;
		border-right: 2px solid var(--accent);
		border-bottom: 2px solid var(--accent);
		opacity: 0.7;
	}

	.resize-handle:hover::after {
		opacity: 1;
	}

	.drag-avatar {
		position: fixed;
		z-index: 1000;
		pointer-events: none;
		opacity: 0.9;
		filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.35));
	}

	.drag-count {
		position: absolute;
		top: -8px;
		right: -8px;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		border-radius: 10px;
		background: var(--accent);
		color: white;
		font-size: 0.72rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.drag-placeholder {
		border: 2px dashed var(--accent);
		background: var(--accent-bg);
		border-radius: var(--radius);
		min-height: 80px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 20px;
		color: var(--text-muted);
		gap: 8px;
	}

	.dimmed {
		opacity: 0.35;
		filter: grayscale(0.7);
		transition: opacity var(--transition), filter var(--transition);
	}

	.highlighted {
		outline: 2px solid #f1c40f;
		outline-offset: -2px;
		border-radius: var(--radius);
		z-index: 2;
	}

	.empty-state p {
		font-size: 1.1rem;
	}

	.hint {
		font-size: 0.85rem !important;
		color: var(--text-muted);
	}

	@media (max-width: 640px) {
		.dashboard-grid-wrapper {
			padding: 8px max(10px, env(safe-area-inset-right)) 16px max(10px, env(safe-area-inset-left));
		}
	}

	/* The toast sits above the bottom edit bar. */
	.dashboard-wrapper.phone-editing .dash-toast {
		bottom: calc(84px + env(safe-area-inset-bottom));
	}
</style>