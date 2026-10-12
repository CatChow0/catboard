<script lang="ts">
	import { onMount } from 'svelte';
	import DashboardItem from './DashboardItem.svelte';
	import Navbar from './Navbar.svelte';
	import AddPopup from './AddPopup.svelte';
	import ServiceModal from './ServiceModal.svelte';
	import {
		services,
		layout,
		isEditing,
		activeBreakpointId,
		manualBreakpointId,
		removeDashboardItem,
		commitLayout,
		getActiveColumns,
		resolveActiveBreakpointId,
		getBreakpointLabel,
		searchQuery
	} from '$lib/stores/dashboard';
	import SettingsModal from './SettingsModal.svelte';
	import type { Service, DashboardItem as DashboardItemType, Layout } from '$lib/stores/dashboard';
	import {
		moveWithPush,
		swapInto,
		resizeWithPush,
		gridMetrics,
		cellAt,
		findNextAvailablePosition,
		type Placed,
		type Bounds,
		type GridMetrics
	} from '$lib/utils/grid';
	import { flipOnMove } from '$lib/utils/flip';

	let showAddPopup = $state(false);
	let showSettings = $state(false);
	let editingService = $state<Service | null>(null);
	let windowWidth = $state(1200);

	let columns = $derived(getActiveColumns($layout?.grid?.breakpoints || [{ minWidth: 0, columns: 4 }], windowWidth));
	let cellSize = $derived($layout?.grid?.cellSize || 80);
	let gap = $derived($layout?.grid?.gap || 12);

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

	function itemMatchesQuery(item: DashboardItemType, q: string): boolean {
		if (!q) return false;
		const lc = q.toLowerCase();
		if (item.type === 'service') {
			const svc = $services.find((s) => s.id === item.serviceId);
			return svc ? svc.name.toLowerCase().includes(lc) : false;
		}
		if (item.type === 'calendar' && 'calendar'.includes(lc)) return true;
		if (item.type === 'clock' && 'clock'.includes(lc)) return true;
		if (item.type === 'weather' && 'weather'.includes(lc)) return true;
		if (item.type === 'docker' && 'docker'.includes(lc)) return true;
		if (item.type === 'uptime-kuma-status-page' && 'uptime'.includes(lc)) return true;
		if (item.type === 'adguard-home' && 'adguard'.includes(lc)) return true;
		if (item.type === 'adguard-home-control' && 'adguard'.includes(lc)) return true;
		if (item.type === 'jellyfin-latest' && 'jellyfin'.includes(lc)) return true;
		if (item.type === 'jellyfin-now-playing' && ('jellyfin'.includes(lc) || 'playing'.includes(lc))) return true;
		if (item.type === 'jellyseerr-requests' && ('jellyseerr'.includes(lc) || 'overseerr'.includes(lc) || 'requests'.includes(lc))) return true;
		if (item.type === 'qbittorrent' && ('qbittorrent'.includes(lc) || 'torrent'.includes(lc))) return true;
		if (item.type === 'notes' && ('notes'.includes(lc) || (item.config?.title ?? '').toLowerCase().includes(lc))) return true;
		if (item.type === 'arr-releases' && ('releases'.includes(lc) || 'arr'.includes(lc))) return true;
		if (item.type === 'stacker' && ('stacker'.includes(lc) || 'system'.includes(lc))) return true;
		if ((item.type === 'group-collapsible' || item.type === 'group-standard') && item.title?.toLowerCase().includes(lc)) return true;
		return false;
	}

	function computeMatchingIds(itemsList: DashboardItemType[], q: string): Set<string> {
		const ids = new Set<string>();
		function visit(it: DashboardItemType) {
			if (itemMatchesQuery(it, q)) ids.add(it.id);
			if ('children' in it) it.children.forEach(visit);
		}
		itemsList.forEach(visit);
		return ids;
	}

	let matchingIds = $derived(query ? computeMatchingIds(items, query) : new Set<string>());

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
	} | null = null;

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

	function boundsOf(c: Container): Bounds {
		if (c === null) return { cols: columns };
		const g = items.find((i) => i.id === c);
		return { cols: g?.colSpan ?? 1, rows: g?.rowSpan ?? 1 };
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

	function metricsOf(c: Container): GridMetrics | null {
		if (c === null) return gridEl ? gridMetrics(gridEl.getBoundingClientRect(), columns, gap, { cellSize }) : null;
		const g = items.find((i) => i.id === c);
		const r = groupGridHomeRect(c);
		return g && r ? gridMetrics(r, g.colSpan, gap, { pad: gap, rows: g.rowSpan }) : null;
	}

	// --- Starting a drag ------------------------------------------------------

	function beginPointer(e: PointerEvent, item: DashboardItemType, source: Container) {
		const selection = source === null ? selectedItemIds : (selectedChildIds.get(source) ?? new Set<string>());
		const ids = selection.has(item.id) && selection.size > 1 ? [item.id, ...[...selection].filter((id) => id !== item.id)] : [item.id];
		pending = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, anchor: item, ids, source, el: e.currentTarget as HTMLElement };
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
		pending = null;
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
			hasGroup
		};
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
				if (!isGroupItem(g) || g.id === d.source || width > g.colSpan) continue;
				// Only the inner grid counts (headers and borders don't), so tiles can
				// be dragged past a group; a collapsed group accepts drops on itself.
				const zone = groupGridHomeRect(g.id) ?? groupHomeRect(g.id);
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

	function autoScroll() {
		if (!drag) return;
		const { y } = lastPointer;
		let v = 0;
		if (y < EDGE) v = -((EDGE - y) / EDGE) * 18;
		else if (y > window.innerHeight - EDGE) v = ((y - (window.innerHeight - EDGE)) / EDGE) * 18;
		if (v) {
			window.scrollBy(0, v);
			updateDrag();
		}
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
			positions = new Map();
			for (const it of moving) {
				const p = findNextAvailablePosition(kids, it.colSpan, it.rowSpan, g.colSpan, g.rowSpan);
				if (p.col + it.colSpan > g.colSpan || p.row + it.rowSpan > g.rowSpan) return;
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
			if (e.pointerId === pending.pointerId && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > THRESHOLD) startDrag();
			return;
		}
		if (drag) updateDrag();
		else if (resize) updateResize();
	}

	function handlePointerUp() {
		if (pending) pending = null;
		else if (drag) finishDrag();
		else if (resize) finishResize();
	}

	function cancelAll() {
		pending = null;
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
		if (e.key !== 'Escape') return;
		if (drag || resize || pending) {
			cancelAll();
			return;
		}
		selectedItemIds = new Set();
		selectedChildIds = new Map();
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
			ghostTransform: `translate(${drag.dx}px, ${drag.dy}px)`,
			preview: isTarget ? drag.preview : null,
			placeholders: isTarget && drag.preview ? drag.ids.map((id) => drag!.preview!.get(id)).filter((r): r is Rect => !!r) : []
		};
	}

	onMount(() => {
		windowWidth = window.innerWidth;
		const onResize = () => { windowWidth = window.innerWidth; };
		window.addEventListener('resize', onResize);
		return () => {
			window.removeEventListener('resize', onResize);
			cancelAnimationFrame(scrollRaf);
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
>
	<Navbar onadd={() => (showAddPopup = true)} onsettings={() => (showSettings = true)} onlogout={handleLogout} />

	<main class="dashboard-grid-wrapper">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={gridEl}
			class="dashboard-grid"
			style="grid-template-columns: repeat({columns}, 1fr); grid-auto-rows: {cellSize}px; gap: {gap}px;"
			onpointerdown={handleGridPointerDown}
		>
			{#each items as item (item.id)}
				{@const r = itemRect(item)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="item-wrapper"
					class:editing={$isEditing}
					class:dragging={isDragged(item.id, null)}
					class:drag-source={drag?.source === item.id}
					class:selected={selectedItemIds.has(item.id) && !drag}
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
	</main>
</div>

{#if showAddPopup}
	<AddPopup onclose={() => (showAddPopup = false)} />
{/if}
{#if showSettings}
	<SettingsModal onclose={() => (showSettings = false)} />
{/if}

{#if editingService}
	<ServiceModal service={editingService} onsave={async (data) => {
		const { updateService } = await import('$lib/stores/dashboard');
		await updateService(editingService!.id, data);
		editingService = null;
	}} onclose={() => (editingService = null)} />
{/if}

<style>
	.dashboard-wrapper {
		min-height: 100vh;
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
	}

	.dashboard-grid {
		display: grid;
		width: 100%;
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
		/* Edit mode only: let pointer events drive the drag instead of page panning. */
		touch-action: none;
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

</style>