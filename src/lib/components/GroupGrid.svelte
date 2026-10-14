<script lang="ts">
	// Inner grid of a group (standard or collapsible): children, drag preview,
	// child resizing, and the optional scrolling content.
	//
	// A group shows colSpan x rowSpan cells. With config.scroll the content may
	// extend along one axis: cells keep their visible size, the extra tracks are
	// reached by scrolling (wheel, touch, trackpad) and no scrollbar is shown;
	// faded edges hint at hidden content. The cell size is exposed as
	// data-cell-w / data-cell-h so the dashboard's drag engine can map pixels to
	// cells even when the grid is scrolled or larger than the group.
	import type { DashboardItem as DashboardItemType, Service, StandardGroupItem, CollapsibleGroupItem } from '$lib/stores/dashboard';
	import { updateChildInGroup, isEditing } from '$lib/stores/dashboard';
	import { maxResize, groupTracks, type GroupDragView } from '$lib/utils/grid';
	import { flipOnMove } from '$lib/utils/flip';
	import DashboardItem from './DashboardItem.svelte';

	let { item, allServices, onedit, onremove, ondragitem, dragView, selectedChildIds, gridGap = 12, query, matchingIds }: {
		item: StandardGroupItem | CollapsibleGroupItem;
		allServices: Service[];
		onedit?: (service: Service) => void;
		onremove?: (itemId: string) => void;
		ondragitem?: (e: PointerEvent, child: DashboardItemType) => void;
		dragView?: GroupDragView | null;
		selectedChildIds?: Set<string>;
		gridGap?: number;
		query?: string;
		matchingIds?: Set<string>;
	} = $props();

	const scroll = $derived(item.config?.scroll);
	const tracks = $derived(groupTracks(item));

	// Visible area; one cell = the visible area split into colSpan x rowSpan.
	let viewW = $state(0);
	let viewH = $state(0);
	const cellW = $derived(Math.max(16, (viewW - 2 * gridGap - (item.colSpan - 1) * gridGap) / item.colSpan));
	const cellH = $derived(Math.max(16, (viewH - 2 * gridGap - (item.rowSpan - 1) * gridGap) / item.rowSpan));

	const gridStyle = $derived.by(() => {
		const common = `gap: ${gridGap}px; padding: ${gridGap}px;`;
		if (scroll === 'vertical')
			return `grid-template-columns: repeat(${item.colSpan}, 1fr); grid-template-rows: repeat(${tracks.rows}, ${cellH}px); grid-auto-rows: ${cellH}px; ${common}`;
		if (scroll === 'horizontal')
			return `grid-template-columns: repeat(${tracks.cols}, ${cellW}px); grid-auto-columns: ${cellW}px; grid-template-rows: repeat(${item.rowSpan}, 1fr); ${common}`;
		return `grid-template-columns: repeat(${item.colSpan}, 1fr); grid-template-rows: repeat(${item.rowSpan}, 1fr); ${common}`;
	});

	// --- Scrolling without a scrollbar ------------------------------------------
	let scroller: HTMLElement | undefined = $state();
	let fadeStart = $state(false);
	let fadeEnd = $state(false);

	function updateFades() {
		const el = scroller;
		if (!el || !scroll) {
			fadeStart = fadeEnd = false;
			return;
		}
		const pos = scroll === 'vertical' ? el.scrollTop : el.scrollLeft;
		const max = scroll === 'vertical' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
		fadeStart = pos > 2;
		fadeEnd = pos < max - 2;
	}

	// Re-evaluate the fades whenever the content or the visible size changes.
	$effect(() => {
		void tracks.rows;
		void tracks.cols;
		void viewW;
		void viewH;
		void dragView;
		queueMicrotask(updateFades);
	});

	// A mouse wheel only scrolls vertically; map it to horizontal scrolling.
	// Registered by hand because it must be able to call preventDefault().
	$effect(() => {
		const el = scroller;
		if (!el || scroll !== 'horizontal') return;
		const onWheel = (e: WheelEvent) => {
			if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
			const max = el.scrollWidth - el.clientWidth;
			const next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
			if (next === el.scrollLeft) return; // at the edge: let the page scroll
			e.preventDefault();
			el.scrollLeft = next;
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	});

	// --- Children ------------------------------------------------------------------
	let resizeState = $state<{
		childId: string;
		startMouseX: number;
		startMouseY: number;
		startColSpan: number;
		startRowSpan: number;
		currentColSpan: number;
		currentRowSpan: number;
	} | null>(null);

	function childRect(child: DashboardItemType) {
		if (resizeState?.childId === child.id) return { col: child.col, row: child.row, colSpan: resizeState.currentColSpan, rowSpan: resizeState.currentRowSpan };
		if (!dragView?.ghostIds.has(child.id) && dragView?.preview?.has(child.id)) return dragView.preview.get(child.id)!;
		return { col: child.col, row: child.row, colSpan: child.colSpan, rowSpan: child.rowSpan };
	}

	function getChildStyle(child: DashboardItemType): string {
		const r = childRect(child);
		// A dragged child stays faded in its cell; the dashboard draws a floating
		// copy under the pointer, which a scrolling group could not clip.
		return `grid-column: ${r.col + 1} / span ${r.colSpan}; grid-row: ${r.row + 1} / span ${r.rowSpan};`;
	}

	function handleResizeStart(e: PointerEvent, child: DashboardItemType) {
		if (!$isEditing) return;
		e.preventDefault();
		e.stopPropagation();
		resizeState = {
			childId: child.id,
			startMouseX: e.clientX,
			startMouseY: e.clientY,
			startColSpan: child.colSpan,
			startRowSpan: child.rowSpan,
			currentColSpan: child.colSpan,
			currentRowSpan: child.rowSpan
		};
	}

	function handlePointerMove(e: PointerEvent) {
		if (!resizeState) return;
		const rs = resizeState;
		const child = item.children.find((c) => c.id === rs.childId);
		if (!child) return;
		const deltaCol = Math.round((e.clientX - rs.startMouseX) / (cellW + gridGap));
		const deltaRow = Math.round((e.clientY - rs.startMouseY) / (cellH + gridGap));
		// The scrolling axis is unbounded; the other one stops at the group's edge.
		const maxColSpan = scroll === 'horizontal' ? Infinity : item.colSpan - child.col;
		const maxRowSpan = scroll === 'vertical' ? Infinity : item.rowSpan - child.row;
		const targetColSpan = Math.max(1, Math.min(rs.startColSpan + deltaCol, maxColSpan));
		const targetRowSpan = Math.max(1, Math.min(rs.startRowSpan + deltaRow, maxRowSpan));
		const result = maxResize(item.children, rs.childId, child.col, child.row, rs.startColSpan, rs.startRowSpan, targetColSpan, targetRowSpan);
		resizeState.currentColSpan = result.colSpan;
		resizeState.currentRowSpan = result.rowSpan;
	}

	function handlePointerUp() {
		if (!resizeState) return;
		const childId = resizeState.childId;
		const updates = { colSpan: resizeState.currentColSpan, rowSpan: resizeState.currentRowSpan };
		resizeState = null;
		updateChildInGroup(item.id, childId, updates);
	}
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

<div
	bind:this={scroller}
	bind:clientWidth={viewW}
	bind:clientHeight={viewH}
	class="group-scroll"
	class:scroll-v={scroll === 'vertical'}
	class:scroll-h={scroll === 'horizontal'}
	style="--fade-a: {fadeStart ? 18 : 0}px; --fade-b: {fadeEnd ? 18 : 0}px;"
	onscroll={updateFades}
>
	<div
		class="group-grid"
		class:resizing={!!resizeState}
		data-cell-w={cellW}
		data-cell-h={cellH}
		style={gridStyle}
	>
		{#each item.children as child (child.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="child-wrapper"
				data-child-id={child.id}
				class:editing={$isEditing}
				class:dragging={dragView?.ghostIds.has(child.id)}
				class:selected={selectedChildIds?.has(child.id) && !dragView}
				class:dimmed={query && !matchingIds?.has(child.id)}
				class:highlighted={query && matchingIds?.has(child.id)}
				style={getChildStyle(child)}
				use:flipOnMove={{ key: Object.values(childRect(child)).join(','), animate: !!dragView && !dragView.ghostIds.has(child.id) }}
				onpointerdown={(e) => ondragitem?.(e, child)}
			>
				<DashboardItem item={child} {allServices} {onedit} {onremove} {query} {matchingIds} />
				{#if $isEditing}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="resize-handle" onpointerdown={(e) => handleResizeStart(e, child)}></div>
				{/if}
			</div>
		{/each}
		{#each dragView?.placeholders ?? [] as p, i (i)}
			<div class="drag-placeholder" style="grid-column: {p.col + 1} / span {p.colSpan}; grid-row: {p.row + 1} / span {p.rowSpan};"></div>
		{/each}
	</div>
</div>

<style>
	.group-scroll {
		flex: 1;
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	/* Scrollable groups: scroll freely but never show a scrollbar. */
	.group-scroll.scroll-v,
	.group-scroll.scroll-h {
		scrollbar-width: none;
		overscroll-behavior: contain;
	}

	.group-scroll.scroll-v::-webkit-scrollbar,
	.group-scroll.scroll-h::-webkit-scrollbar {
		display: none;
	}

	.group-scroll.scroll-v {
		overflow-y: auto;
		mask-image: linear-gradient(to bottom, transparent 0, #000 var(--fade-a), #000 calc(100% - var(--fade-b)), transparent 100%);
	}

	.group-scroll.scroll-h {
		overflow-x: auto;
		flex-direction: row;
		mask-image: linear-gradient(to right, transparent 0, #000 var(--fade-a), #000 calc(100% - var(--fade-b)), transparent 100%);
	}

	.group-grid {
		display: grid;
		flex: 1;
		min-height: 0;
	}

	/* Scrolling content is as big as its tracks, not as big as the group. */
	.scroll-v .group-grid {
		flex: none;
	}

	.scroll-h .group-grid {
		flex: none;
		width: max-content;
		height: 100%;
	}

	.group-grid.resizing {
		user-select: none;
	}

	.child-wrapper {
		position: relative;
		min-width: 0;
		min-height: 0;
	}

	.child-wrapper.editing {
		touch-action: none;
		cursor: grab;
	}

	.child-wrapper.editing:active {
		cursor: grabbing;
	}

	.child-wrapper.selected {
		outline: 3px solid var(--accent);
		outline-offset: -3px;
		border-radius: var(--radius);
		z-index: 1;
		box-shadow: 0 0 0 3px var(--accent), 0 0 12px var(--accent-glow);
		background: var(--accent-bg);
		animation: select-pulse 2s ease-in-out infinite;
	}

	/* Where the dragged child came from (its floating copy follows the pointer). */
	.child-wrapper.dragging {
		opacity: 0.3;
		pointer-events: none;
	}

	.child-wrapper.dimmed {
		opacity: 0.35;
		filter: grayscale(0.7);
	}

	.child-wrapper.highlighted {
		outline: 2px solid #f1c40f;
		outline-offset: -2px;
		border-radius: var(--radius);
		z-index: 2;
	}

	@keyframes select-pulse {
		0%, 100% { box-shadow: 0 0 0 3px var(--accent), 0 0 12px var(--accent-glow); }
		50% { box-shadow: 0 0 0 4px var(--accent), 0 0 20px var(--accent-glow); }
	}

	.resize-handle {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 16px;
		height: 16px;
		cursor: nwse-resize;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.child-wrapper:hover .resize-handle {
		opacity: 1;
	}

	.resize-handle::after {
		content: '';
		position: absolute;
		bottom: 3px;
		right: 3px;
		width: 8px;
		height: 8px;
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
	}
</style>
