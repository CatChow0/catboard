<script lang="ts">
	import type { StandardGroupItem, Service, DashboardItem as DashboardItemType } from '$lib/stores/dashboard';
	import { updateDashboardItem, updateChildInGroup, isEditing } from '$lib/stores/dashboard';
	import { maxResize } from '$lib/utils/grid';
	import DashboardItem from './DashboardItem.svelte';

	let { item, allServices, onedit, onremove, ondragitem, draggingChildId, dragPlaceholder, selectedChildIds, ontogglechild, gridGap = 12, query, matchingIds }: {
		item: StandardGroupItem;
		allServices: Service[];
		onedit?: (service: Service) => void;
		onremove?: (itemId: string) => void;
		ondragitem?: (e: PointerEvent, child: DashboardItemType) => void;
		draggingChildId?: string | null;
		dragPlaceholder?: { col: number; row: number; colSpan: number; rowSpan: number } | null;
		selectedChildIds?: Set<string>;
		ontogglechild?: (groupId: string, childId: string, multiSelect: boolean) => void;
		gridGap?: number;
		query?: string;
		matchingIds?: Set<string>;
	} = $props();

	let showEditModal = $state(false);
	let editTitle = $state(item.title);
	let editCompact = $state(item.config?.compact ?? false);
	let editOutlineColor = $state(item.config?.outlineColor ?? '');

	const compact = $derived(item.config?.compact ?? false);
	const outlineStyle = $derived(
		item.config?.outlineColor ? `border-color: ${item.config.outlineColor};` : ''
	);

	let gridEl: HTMLElement | undefined = $state();

	const colStep = $derived(() => {
		if (!gridEl) return gridGap + 80;
		const rect = gridEl.getBoundingClientRect();
		const cols = item.colSpan;
		return (rect.width - (cols + 1) * gridGap) / cols + gridGap;
	});
	const rowStep = $derived(() => {
		if (!gridEl) return gridGap + 80;
		const rect = gridEl.getBoundingClientRect();
		const rows = item.rowSpan;
		return (rect.height - (rows + 1) * gridGap) / rows + gridGap;
	});

	let resizeState = $state<{
		childId: string;
		startMouseX: number;
		startMouseY: number;
		startColSpan: number;
		startRowSpan: number;
		currentColSpan: number;
		currentRowSpan: number;
	} | null>(null);

	function getChildStyle(child: DashboardItemType): string {
		if (resizeState?.childId === child.id) {
			return `grid-column: ${child.col + 1} / span ${resizeState.currentColSpan}; grid-row: ${child.row + 1} / span ${resizeState.currentRowSpan};`;
		}
		return `grid-column: ${child.col + 1} / span ${child.colSpan}; grid-row: ${child.row + 1} / span ${child.rowSpan};`;
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
		const child = item.children.find(c => c.id === rs.childId);
		if (!child) return;
		const deltaX = e.clientX - rs.startMouseX;
		const deltaY = e.clientY - rs.startMouseY;
		const cs = colStep();
		const rs2 = rowStep();
		const deltaCol = Math.round(deltaX / cs);
		const deltaRow = Math.round(deltaY / rs2);
		const maxColSpan = item.colSpan - child.col;
		const targetColSpan = Math.max(1, Math.min(rs.startColSpan + deltaCol, maxColSpan));
		const targetRowSpan = Math.max(1, rs.startRowSpan + deltaRow);
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

	function openEditModal() {
		editTitle = item.title;
		editCompact = item.config?.compact ?? false;
		editOutlineColor = item.config?.outlineColor ?? '';
		showEditModal = true;
	}

	async function handleSaveEdit() {
		showEditModal = false;
		const updates: Record<string, unknown> = { title: editTitle.trim() || item.title };
		updates.config = { ...item.config, compact: editCompact, outlineColor: editOutlineColor || undefined };
		await updateDashboardItem(item.id, updates as any);
	}
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

<div class="group standard" class:compact style={outlineStyle} data-group-id={item.id}>
	{#if !compact}
		<div class="group-header">
			<span class="group-title">{item.title}</span>
		</div>
	{/if}
	{#if $isEditing}
		<button class="btn-delete" onclick={() => onremove?.(item.id)} title="Remove group">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={openEditModal} title="Edit group">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	{/if}
	{#if showEditModal}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="edit-overlay" onclick={() => (showEditModal = false)}></div>
		<div class="edit-modal">
			<h3>Edit Group</h3>
			<div class="field">
				<label>Title</label>
				<input type="text" bind:value={editTitle} placeholder="Group name" />
			</div>
			<label class="toggle-switch">
				<input type="checkbox" bind:checked={editCompact} />
				<span class="toggle-slider"></span>
				<span class="toggle-label">Compact mode (no header)</span>
			</label>
			<div class="field">
				<label>Outline color</label>
				<div class="color-row">
					<input type="color" bind:value={editOutlineColor} />
					{#if editOutlineColor}
						<button class="btn-clear-color" onclick={() => (editOutlineColor = '')} title="Clear color">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					{/if}
				</div>
			</div>
			<div class="modal-actions">
				<button class="btn-cancel" onclick={() => (showEditModal = false)}>Cancel</button>
				<button class="btn-save" onclick={handleSaveEdit}>Save</button>
			</div>
		</div>
	{/if}
	<div
		bind:this={gridEl}
		class="group-grid"
		class:resizing={!!resizeState}
		style="grid-template-columns: repeat({item.colSpan}, 1fr); grid-template-rows: repeat({item.rowSpan}, 1fr); gap: {gridGap}px; padding: {gridGap}px;"
	>
		{#each item.children as child (child.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="child-wrapper"
				class:editing={$isEditing}
				class:dragging={draggingChildId === child.id || (selectedChildIds?.has(child.id) && draggingChildId)}
				class:selected={selectedChildIds?.has(child.id) && !draggingChildId}
				class:dimmed={query && !matchingIds?.has(child.id)}
				class:highlighted={query && matchingIds?.has(child.id)}
				style={getChildStyle(child)}
				onpointerdown={(e) => ondragitem?.(e, child)}
			>
				<DashboardItem item={child} {allServices} {onedit} {onremove} {query} {matchingIds} />
				{#if $isEditing}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="resize-handle"
						onpointerdown={(e) => handleResizeStart(e, child)}
					></div>
				{/if}
			</div>
		{/each}
		{#if dragPlaceholder}
			<div
				class="drag-placeholder"
				style="grid-column: {dragPlaceholder.col + 1} / span {dragPlaceholder.colSpan}; grid-row: {dragPlaceholder.row + 1} / span {dragPlaceholder.rowSpan};"
			></div>
		{/if}
	</div>
</div>

<style>
	.group {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: visible;
	}

	.group.compact {
		border-radius: var(--radius);
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.group-title {
		font-weight: 600;
		font-size: 0.9rem;
		flex: 1;
	}

	.btn-delete {
		position: absolute;
		top: -8px;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--danger);
		color: white;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.btn-delete:hover {
		background: #c0392b;
	}

	.btn-edit {
		position: absolute;
		bottom: -8px;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--accent);
		color: white;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.group:hover .btn-delete,
	.group:hover .btn-edit {
		opacity: 1;
	}

	.btn-edit:hover {
		background: var(--accent-hover);
	}

	.edit-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 100;
		background: rgba(0,0,0,0.4);
	}

	.edit-modal {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--bg-modal);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 20px;
		z-index: 101;
		min-width: 260px;
		max-width: 340px;
		box-shadow: 0 8px 32px rgba(0,0,0,0.4);
	}

	.edit-modal h3 {
		font-size: 0.95rem;
		margin-bottom: 14px;
	}

	.field {
		margin-bottom: 10px;
	}

	.field label {
		display: block;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: 3px;
	}

	.field input[type="text"] {
		width: 100%;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.field input[type="text"]:focus {
		border-color: var(--accent);
	}

	.color-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.color-row input[type="color"] {
		width: 36px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		cursor: pointer;
	}

	.btn-clear-color {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		border-radius: 4px;
		border: 1px solid var(--border);
		color: var(--text-muted);
	}

	.btn-clear-color:hover {
		background: var(--danger);
		color: white;
		border-color: var(--danger);
	}

	.toggle-switch {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		margin-bottom: 14px;
		position: relative;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
		position: absolute;
	}

	.toggle-slider {
		width: 36px;
		height: 20px;
		background: var(--border);
		border-radius: 20px;
		position: relative;
		transition: background var(--transition);
		flex-shrink: 0;
	}

	.toggle-slider::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: white;
		border-radius: 50%;
		transition: transform var(--transition);
	}

	.toggle-switch input:checked + .toggle-slider {
		background: var(--accent);
	}

	.toggle-switch input:checked + .toggle-slider::after {
		transform: translateX(16px);
	}

	.toggle-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.btn-cancel {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		color: var(--text-secondary);
	}

	.btn-save {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: white;
		font-weight: 500;
	}

	.btn-save:hover {
		background: var(--accent-hover);
	}

	.group-grid {
		display: grid;
		flex: 1;
		min-height: 0;
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

	.child-wrapper.dragging {
		opacity: 0.4;
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