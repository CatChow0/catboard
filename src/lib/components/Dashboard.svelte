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
		loadDashboard,
		saveLayout,
		removeDashboardItem,
		updateDashboardItem,
		moveItemToGroup,
			batchMoveToGroup,
			batchMoveToRoot,
		moveItemToRoot,
		updateChildInGroup,
		getActiveColumns,
		resolveActiveBreakpointId,
		getBreakpointLabel,
		batchUpdatePositions,
			batchUpdateChildPositions,
		searchQuery
	} from '$lib/stores/dashboard';
	import SettingsModal from './SettingsModal.svelte';
	import type { Service, DashboardItem as DashboardItemType } from '$lib/stores/dashboard';
	import { hasCollision, hasCollisionExcluding, clampPosition, maxResize } from '$lib/utils/grid';

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

	let dragState = $state<{
		itemId: string;
		startMouseX: number;
		startMouseY: number;
		startCol: number;
		startRow: number;
		currentCol: number;
		currentRow: number;
		colSpan: number;
		rowSpan: number;
		item: DashboardItemType;
		dropTargetGroupId: string | null;
		sourceGroupId: string | null;
		withinGroupCol: number;
		withinGroupRow: number;
		multiDrag?: boolean;
		multiDragOffsets?: Map<string, { startCol: number; startRow: number; colSpan: number; rowSpan: number }>;
		multiDragPositions?: Map<string, { col: number; row: number; colSpan: number; rowSpan: number }>;
	} | null>(null);

	let resizeState = $state<{
		itemId: string;
		startMouseX: number;
		startMouseY: number;
		startColSpan: number;
		startRowSpan: number;
		currentColSpan: number;
		currentRowSpan: number;
	} | null>(null);

	let activeBreakpointIdValue = $derived($activeBreakpointId);
	let activeLayout = $derived($layout?.layouts?.[activeBreakpointIdValue] || { items: [], navbar: { columns: 12, items: [] } });
	let items = $derived(activeLayout.items || []);
	let dropTargetGroupId = $derived(dragState?.dropTargetGroupId ?? null);

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

	function getEffectiveColSpan(item: DashboardItemType): number {
		if (resizeState?.itemId === item.id) return resizeState.currentColSpan;
		return item.colSpan;
	}

	function getEffectiveRowSpan(item: DashboardItemType): number {
		if (resizeState?.itemId === item.id) return resizeState.currentRowSpan;
		return item.rowSpan;
	}

	function getItemStyle(item: DashboardItemType): string {
		const cs = getEffectiveColSpan(item);
		const rs = getEffectiveRowSpan(item);
		if (dragState?.multiDrag && dragState.multiDragPositions?.has(item.id)) {
			const pos = dragState.multiDragPositions.get(item.id)!;
			return `grid-column: ${pos.col + 1} / span ${pos.colSpan}; grid-row: ${pos.row + 1} / span ${pos.rowSpan};`;
		}
		if (dragState?.itemId === item.id) {
			return `grid-column: ${dragState.currentCol + 1} / span ${cs}; grid-row: ${dragState.currentRow + 1} / span ${rs};`;
		}
		return `grid-column: ${item.col + 1} / span ${cs}; grid-row: ${item.row + 1} / span ${rs};`;
	}

	function getColumnWidth(): number {
		if (!gridEl) return 100;
		return gridEl.getBoundingClientRect().width / columns;
	}

	function handlePointerDownOnItem(e: PointerEvent, item: DashboardItemType) {
		if (!$isEditing) return;
		selectedChildIds = new Map();
		if (resizeState) return;
		if ((e.target as HTMLElement).closest('.resize-handle, .btn-edit, .btn-delete, .modal-overlay')) return;
		if ((e.target as HTMLElement).closest('.child-wrapper')) return;

		const isGroup = item.type === 'group-collapsible' || item.type === 'group-standard';

		if (e.shiftKey || e.ctrlKey || e.metaKey) {
			e.preventDefault();
			if (!isGroup) {
				const newSet = new Set(selectedItemIds);
				if (newSet.has(item.id)) {
					newSet.delete(item.id);
				} else {
					newSet.add(item.id);
				}
				selectedItemIds = newSet;
			}
			return;
		}

		if (!selectedItemIds.has(item.id)) {
			selectedItemIds = new Set(isGroup ? [] : [item.id]);
		}

		e.preventDefault();
		const clamped = clampPosition(item.col, item.row, item.colSpan, item.rowSpan, columns);

		if (selectedItemIds.size > 1 && !isGroup) {
			const offsets = new Map<string, { startCol: number; startRow: number; colSpan: number; rowSpan: number }>();
			for (const id of selectedItemIds) {
				const selItem = items.find(i => i.id === id);
				if (!selItem) continue;
				offsets.set(id, { startCol: selItem.col, startRow: selItem.row, colSpan: selItem.colSpan, rowSpan: selItem.rowSpan });
			}
			const positions = new Map<string, { col: number; row: number; colSpan: number; rowSpan: number }>();
			for (const [id, off] of offsets) {
				positions.set(id, { col: off.startCol, row: off.startRow, colSpan: off.colSpan, rowSpan: off.rowSpan });
			}
			dragState = {
				itemId: item.id,
				startMouseX: e.clientX,
				startMouseY: e.clientY,
				startCol: clamped.col,
				startRow: clamped.row,
				currentCol: clamped.col,
				currentRow: clamped.row,
				colSpan: item.colSpan,
				rowSpan: item.rowSpan,
				item,
				dropTargetGroupId: null,
				sourceGroupId: null,
				withinGroupCol: 0,
				withinGroupRow: 0,
				multiDrag: true,
				multiDragOffsets: offsets,
				multiDragPositions: positions
			};
		} else {
			dragState = {
				itemId: item.id,
				startMouseX: e.clientX,
				startMouseY: e.clientY,
				startCol: clamped.col,
				startRow: clamped.row,
				currentCol: clamped.col,
				currentRow: clamped.row,
				colSpan: item.colSpan,
				rowSpan: item.rowSpan,
				item,
				dropTargetGroupId: null,
				sourceGroupId: null,
				withinGroupCol: 0,
				withinGroupRow: 0
			};
		}
	}

	function handleGridPointerDown(e: PointerEvent) {
		if (!$isEditing) return;
		if ((e.target as HTMLElement).closest('.item-wrapper')) return;
		selectedItemIds = new Set();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			selectedItemIds = new Set();
			selectedChildIds = new Map();
		}
	}

	function handlePointerDownOnResize(e: PointerEvent, item: DashboardItemType) {
		if (!$isEditing) return;
		e.preventDefault();
		e.stopPropagation();
		resizeState = {
			itemId: item.id,
			startMouseX: e.clientX,
			startMouseY: e.clientY,
			startColSpan: item.colSpan,
			startRowSpan: item.rowSpan,
			currentColSpan: item.colSpan,
			currentRowSpan: item.rowSpan
		};
	}

	function toggleChildSelection(groupId: string, childId: string, multiSelect: boolean) {
		const current = selectedChildIds.get(groupId) || new Set<string>();
		const newSet = new Set(current);
		if (multiSelect) {
			if (newSet.has(childId)) newSet.delete(childId);
			else newSet.add(childId);
		} else {
			if (newSet.size === 1 && newSet.has(childId)) {
				newSet.clear();
			} else {
				newSet.clear();
				newSet.add(childId);
			}
		}
		const newMap = new Map(selectedChildIds);
		if (newSet.size === 0) newMap.delete(groupId);
		else newMap.set(groupId, newSet);
		selectedChildIds = newMap;
	}

	function handleDragChildFromGroup(e: PointerEvent, child: DashboardItemType) {
		if (!$isEditing) return;
		if (resizeState) return;
		if ((e.target as HTMLElement).closest('.resize-handle, .btn-edit, .btn-delete, .modal-overlay')) return;

		const groupEl = (e.target as HTMLElement).closest('[data-group-id]');
		const groupId = groupEl ? (groupEl as HTMLElement).dataset.groupId! : null;
		if (!groupId) return;

		if (e.shiftKey || e.ctrlKey || e.metaKey) {
			e.preventDefault();
			e.stopPropagation();
			toggleChildSelection(groupId, child.id, true);
			return;
		}

		e.preventDefault();
		e.stopPropagation();

		const groupChildren = selectedChildIds.get(groupId);
		const selectedInGroup = groupChildren && groupChildren.size > 0 ? groupChildren : new Set<string>();

		selectedItemIds = new Set();
		const newChildMap = new Map(selectedChildIds);
		const currentGroupSelection = newChildMap.get(groupId);
		newChildMap.clear();
		if (currentGroupSelection) newChildMap.set(groupId, currentGroupSelection);
		selectedChildIds = newChildMap;

		const group = items.find(i => i.id === groupId);
		const children = group && 'children' in group ? group.children : [];

		if (selectedInGroup.has(child.id) && selectedInGroup.size > 1) {
			const offsets = new Map<string, { startCol: number; startRow: number; colSpan: number; rowSpan: number }>();
			for (const id of selectedInGroup) {
				const ch = children.find(ch => ch.id === id);
				if (!ch) continue;
				offsets.set(id, { startCol: ch.col, startRow: ch.row, colSpan: ch.colSpan, rowSpan: ch.rowSpan });
			}
			const positions = new Map<string, { col: number; row: number; colSpan: number; rowSpan: number }>();
			for (const [id, off] of offsets) {
				positions.set(id, { col: off.startCol, row: off.startRow, colSpan: off.colSpan, rowSpan: off.rowSpan });
			}
			dragState = {
				itemId: child.id,
				startMouseX: e.clientX,
				startMouseY: e.clientY,
				startCol: child.col,
				startRow: child.row,
				currentCol: 0,
				currentRow: 0,
				colSpan: child.colSpan,
				rowSpan: child.rowSpan,
				item: child,
				dropTargetGroupId: groupId,
				sourceGroupId: groupId,
				withinGroupCol: child.col,
				withinGroupRow: child.row,
				multiDrag: true,
				multiDragOffsets: offsets,
				multiDragPositions: positions
			};
		} else {
			selectedChildIds = new Map([[groupId, new Set([child.id])]]);
			dragState = {
				itemId: child.id,
				startMouseX: e.clientX,
				startMouseY: e.clientY,
				startCol: child.col,
				startRow: child.row,
				currentCol: 0,
				currentRow: 0,
				colSpan: child.colSpan,
				rowSpan: child.rowSpan,
				item: child,
				dropTargetGroupId: groupId,
				sourceGroupId: groupId,
				withinGroupCol: child.col,
				withinGroupRow: child.row
			};
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (dragState) {
			const ds = dragState;
			const el = document.elementFromPoint(e.clientX, e.clientY);
			const groupEl = el?.closest('[data-group-id]');
			const groupId = groupEl ? (groupEl as HTMLElement).dataset.groupId! : null;
			ds.dropTargetGroupId = (groupId && groupId !== ds.itemId) ? groupId : null;

			if (ds.sourceGroupId && ds.dropTargetGroupId === ds.sourceGroupId) {
				const groupGridEl = document.querySelector(`[data-group-id="${ds.sourceGroupId}"] .group-grid`);
				if (groupGridEl) {
					const rect = groupGridEl.getBoundingClientRect();
					const x = e.clientX - rect.left;
					const y = e.clientY - rect.top;
					const group = items.find(i => i.id === ds.sourceGroupId);
					const groupCols = group?.colSpan || 6;
					const groupRows = group?.rowSpan || 1;
					const cellWidth = (rect.width - (groupCols + 1) * gap) / groupCols;
					const cellHeight = (rect.height - (groupRows + 1) * gap) / groupRows;
					const col = Math.max(0, Math.min(Math.floor((x - gap) / (cellWidth + gap)), groupCols - ds.colSpan));
					const row = Math.max(0, Math.floor((y - gap) / (cellHeight + gap)));

					if (ds.multiDrag && ds.multiDragOffsets) {
						const deltaCol = col - ds.startCol;
						const deltaRow = row - ds.startRow;
						const group = items.find(i => i.id === ds.sourceGroupId);
						const children = group && 'children' in group ? group.children : [];
						const candidatePositions = new Map<string, { col: number; row: number; colSpan: number; rowSpan: number }>();
						let allValid = true;
						for (const [id, off] of ds.multiDragOffsets) {
							const newCol = off.startCol + deltaCol;
							const newRow = off.startRow + deltaRow;
							const clamped = clampPosition(newCol, newRow, off.colSpan, off.rowSpan, groupCols);
							if (clamped.col !== newCol || clamped.row !== newRow) {
								allValid = false;
								break;
							}
							candidatePositions.set(id, { col: clamped.col, row: clamped.row, colSpan: off.colSpan, rowSpan: off.rowSpan });
						}
						const excludeIds = selectedChildIds.get(ds.sourceGroupId) || new Set<string>();
						if (allValid && !hasCollisionExcluding(children, excludeIds, candidatePositions)) {
							ds.multiDragPositions = candidatePositions;
							ds.withinGroupCol = candidatePositions.get(ds.itemId)!.col;
							ds.withinGroupRow = candidatePositions.get(ds.itemId)!.row;
						}
					} else {
						const group = items.find(i => i.id === ds.sourceGroupId);
						const children = group && "children" in group ? group.children : [];
						if (!hasCollision(children, ds.itemId, col, row, ds.colSpan, ds.rowSpan)) {
							ds.withinGroupCol = col;
							ds.withinGroupRow = row;
						}
					}
				}
				return;
			}

			if (ds.dropTargetGroupId) {
				const targetGroup = items.find(i => i.id === ds.dropTargetGroupId);
				if (targetGroup && 'children' in targetGroup) {
					const groupGridEl = document.querySelector(`[data-group-id="${ds.dropTargetGroupId}"] .group-grid`);
					if (groupGridEl) {
						const rect = groupGridEl.getBoundingClientRect();
						const x = e.clientX - rect.left;
						const y = e.clientY - rect.top;
						const groupCols = targetGroup.colSpan;
						const groupRows = targetGroup.rowSpan;
						const cellWidth = (rect.width - (groupCols + 1) * gap) / groupCols;
						const cellHeight = (rect.height - (groupRows + 1) * gap) / groupRows;
						const col = Math.max(0, Math.min(Math.floor((x - gap) / (cellWidth + gap)), groupCols - ds.colSpan));
						const row = Math.max(0, Math.floor((y - gap) / (cellHeight + gap)));
						if (!hasCollision(targetGroup.children, ds.itemId, col, row, ds.colSpan, ds.rowSpan)) {
							ds.withinGroupCol = col;
							ds.withinGroupRow = row;
						}
					}
				}
				return;
			}

				if (ds.sourceGroupId) {
				if (!gridEl) return;
				const rect = gridEl.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;
				const colWidth = rect.width / columns;
				const rowHeight = cellSize + gap;
				const col = Math.max(0, Math.min(Math.floor(x / colWidth), columns - 1));
				const row = Math.max(0, Math.floor(y / rowHeight));

				if (ds.multiDrag && ds.multiDragOffsets) {
					if (!hasCollision(items, ds.itemId, col, row, ds.colSpan, ds.rowSpan)) {
						ds.currentCol = col;
						ds.currentRow = row;
						const anchorDeltaCol = col - ds.startCol;
						const anchorDeltaRow = row - ds.startRow;
						const candidatePositions = new Map<string, { col: number; row: number; colSpan: number; rowSpan: number }>();
						let allValid = true;
						for (const [id, off] of ds.multiDragOffsets) {
							const newCol = off.startCol + anchorDeltaCol;
							const newRow = off.startRow + anchorDeltaRow;
							const clamped = clampPosition(newCol, newRow, off.colSpan, off.rowSpan, columns);
							if (clamped.col !== newCol || clamped.row !== newRow) { allValid = false; break; }
							candidatePositions.set(id, { col: clamped.col, row: clamped.row, colSpan: off.colSpan, rowSpan: off.rowSpan });
						}
						if (allValid && !hasCollisionExcluding(items, new Set(ds.multiDragOffsets.keys()), candidatePositions)) {
							ds.multiDragPositions = candidatePositions;
						}
					}
				} else {
					if (!hasCollision(items, ds.itemId, col, row, ds.colSpan, ds.rowSpan)) {
						ds.currentCol = col;
						ds.currentRow = row;
					}
				}
			} else {
				const colWidth = getColumnWidth();
				const rowHeight = cellSize + gap;
				const deltaX = e.clientX - ds.startMouseX;
				const deltaY = e.clientY - ds.startMouseY;
				const deltaCol = Math.round(deltaX / colWidth);
				const deltaRow = Math.round(deltaY / rowHeight);

				if (ds.multiDrag && ds.multiDragOffsets) {
					let newAnchorCol = ds.startCol + deltaCol;
					let newAnchorRow = ds.startRow + deltaRow;
					const clampedAnchor = clampPosition(newAnchorCol, newAnchorRow, ds.colSpan, ds.rowSpan, columns);
					const anchorDeltaCol = clampedAnchor.col - ds.startCol;
					const anchorDeltaRow = clampedAnchor.row - ds.startRow;

					const candidatePositions = new Map<string, { col: number; row: number; colSpan: number; rowSpan: number }>();
					let allValid = true;

					for (const [id, off] of ds.multiDragOffsets) {
						const newCol = off.startCol + anchorDeltaCol;
						const newRow = off.startRow + anchorDeltaRow;
						const clamped = clampPosition(newCol, newRow, off.colSpan, off.rowSpan, columns);
						if (clamped.col !== newCol || clamped.row !== newRow) {
							allValid = false;
							break;
						}
						candidatePositions.set(id, { col: clamped.col, row: clamped.row, colSpan: off.colSpan, rowSpan: off.rowSpan });
					}

					if (allValid && !hasCollisionExcluding(items, selectedItemIds, candidatePositions)) {
						ds.multiDragPositions = candidatePositions;
						ds.currentCol = candidatePositions.get(ds.itemId)!.col;
						ds.currentRow = candidatePositions.get(ds.itemId)!.row;
					}
				} else {
					let newCol = ds.startCol + deltaCol;
					let newRow = ds.startRow + deltaRow;
					const clamped = clampPosition(newCol, newRow, ds.colSpan, ds.rowSpan, columns);
					if (!hasCollision(items, ds.itemId, clamped.col, clamped.row, ds.colSpan, ds.rowSpan)) {
						ds.currentCol = clamped.col;
						ds.currentRow = clamped.row;
					}
				}
			}
		} else if (resizeState) {
			const rs = resizeState;
			const colWidth = getColumnWidth();
			const rowHeight = cellSize + gap;
			const deltaX = e.clientX - rs.startMouseX;
			const deltaY = e.clientY - rs.startMouseY;
			const deltaCol = Math.round(deltaX / colWidth);
			const deltaRow = Math.round(deltaY / rowHeight);
			const item = items.find((i) => i.id === rs.itemId);
			if (!item) return;
			const maxColSpan = columns - item.col;
			const targetColSpan = Math.max(1, Math.min(rs.startColSpan + deltaCol, maxColSpan));
			const targetRowSpan = Math.max(1, rs.startRowSpan + deltaRow);
			const result = maxResize(items, rs.itemId, item.col, item.row, rs.startColSpan, rs.startRowSpan, targetColSpan, targetRowSpan);
			resizeState.currentColSpan = result.colSpan;
			resizeState.currentRowSpan = result.rowSpan;
		}
	}

	function handlePointerUp() {
		if (dragState) {
			const ds = dragState;

			if (ds.multiDrag && ds.multiDragPositions && !ds.dropTargetGroupId && !ds.sourceGroupId) {
				const updates = new Map<string, { col: number; row: number }>();
				for (const [id, pos] of ds.multiDragPositions) {
					updates.set(id, { col: pos.col, row: pos.row });
				}
				dragState = null;
				batchUpdatePositions(updates);
				selectedItemIds = new Set();
			} else if (ds.multiDrag && ds.dropTargetGroupId && ds.dropTargetGroupId !== ds.sourceGroupId && !ds.sourceGroupId) {
				const groupId = ds.dropTargetGroupId;
				const baseCol = ds.withinGroupCol;
				const baseRow = ds.withinGroupRow;
				const positions = new Map<string, { col: number; row: number }>();
				const sortedIds = [...selectedItemIds];
				if (ds.multiDragOffsets) {
					for (const [id, off] of ds.multiDragOffsets) {
						const relCol = off.startCol - ds.startCol;
						const relRow = off.startRow - ds.startRow;
						positions.set(id, { col: baseCol + relCol, row: baseRow + relRow });
					}
				} else {
					for (let i = 0; i < sortedIds.length; i++) {
						positions.set(sortedIds[i], { col: baseCol, row: baseRow + i });
					}
				}
				dragState = null;
				batchMoveToGroup(sortedIds, groupId, positions);
				selectedItemIds = new Set();
			} else {
				const itemId = ds.itemId;
				const targetGroup = ds.dropTargetGroupId;
				const sourceGroup = ds.sourceGroupId;
				const col = ds.currentCol;
				const row = ds.currentRow;
				const withinCol = ds.withinGroupCol;
				const withinRow = ds.withinGroupRow;
				dragState = null;

				if (sourceGroup && targetGroup === sourceGroup) {
					if (ds.multiDrag && ds.multiDragPositions) {
						const childUpdates = new Map<string, { col: number; row: number }>();
						for (const [id, pos] of ds.multiDragPositions) {
							childUpdates.set(id, { col: pos.col, row: pos.row });
						}
						batchUpdateChildPositions(sourceGroup, childUpdates);
						selectedChildIds = new Map();
					} else {
						updateChildInGroup(sourceGroup, itemId, { col: withinCol, row: withinRow });
					selectedChildIds = new Map();
					}
				} else if (targetGroup && targetGroup !== sourceGroup) {
					moveItemToGroup(itemId, targetGroup, { col: withinCol, row: withinRow });
					selectedChildIds = new Map();
					selectedItemIds = new Set();
				} else if (sourceGroup && !targetGroup) {
					if (ds.multiDrag && ds.multiDragOffsets) {
						const sortedIds = [...ds.multiDragOffsets.keys()];
						dragState = null;
						batchMoveToRoot(sortedIds, columns);
						selectedChildIds = new Map();
					} else {
						moveItemToRoot(itemId, columns);
						selectedChildIds = new Map();
					}
				} else {
					updateDashboardItem(itemId, { col, row });
				}
			}
		}
		if (resizeState) {
			const itemId = resizeState.itemId;
			const updates = { colSpan: resizeState.currentColSpan, rowSpan: resizeState.currentRowSpan };
			resizeState = null;
			updateDashboardItem(itemId, updates);
		}
	}

	onMount(() => {
		windowWidth = window.innerWidth;
		const onResize = () => { windowWidth = window.innerWidth; };
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
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
<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} onkeydown={handleKeyDown} />

<div
	class="dashboard-wrapper"
	class:edit-mode={$isEditing}
	class:dragging={!!dragState}
	class:resizing={!!resizeState}
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
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="item-wrapper"
					class:editing={$isEditing}
					class:dragging={dragState?.itemId === item.id || (dragState?.multiDrag && selectedItemIds.has(item.id))}
					class:selected={selectedItemIds.has(item.id) && !dragState}
					class:drop-target={dropTargetGroupId === item.id && dragState?.sourceGroupId !== item.id}
					class:dimmed={query && !matchingIds.has(item.id)}
					class:highlighted={query && matchingIds.has(item.id)}
					style={getItemStyle(item)}
					onpointerdown={(e) => handlePointerDownOnItem(e, item)}
				>
					<DashboardItem
						{item}
						allServices={$services}
						effectiveColSpan={getEffectiveColSpan(item)}
						effectiveRowSpan={getEffectiveRowSpan(item)}
						gridGap={gap}
						onedit={handleEditService}
						onremove={handleRemoveItem}
						ondragitem={handleDragChildFromGroup}
						draggingChildId={dragState?.sourceGroupId === item.id ? dragState.itemId : null}
						dragPlaceholder={dragState?.dropTargetGroupId === item.id ? { col: dragState.withinGroupCol, row: dragState.withinGroupRow, colSpan: dragState.colSpan, rowSpan: dragState.rowSpan } : null}
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

			{#if dragState && !dragState.dropTargetGroupId}
				{#if dragState.multiDrag && dragState.multiDragPositions && !dragState.sourceGroupId}
					{#each [...dragState.multiDragPositions.entries()] as [id, pos] (id)}
						<div
							class="drag-placeholder"
							style="grid-column: {pos.col + 1} / span {pos.colSpan}; grid-row: {pos.row + 1} / span {pos.rowSpan};"
						></div>
					{/each}
				{:else}
					<div
						class="drag-placeholder"
						style="grid-column: {dragState.currentCol + 1} / span {dragState.colSpan}; grid-row: {dragState.currentRow + 1} / span {dragState.rowSpan};"
					></div>
				{/if}
			{/if}
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
	}

	.item-wrapper.editing:active {
		cursor: grabbing;
	}

	.item-wrapper.dragging {
		opacity: 0.4;
	}

	.item-wrapper.drop-target {
		outline: 2px solid var(--accent) !important;
		outline-offset: -2px;
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