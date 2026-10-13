<script lang="ts">
	import type { StandardGroupItem, Service, DashboardItem as DashboardItemType } from '$lib/stores/dashboard';
	import type { GroupScroll } from '$lib/types';
	import { updateDashboardItem, isEditing } from '$lib/stores/dashboard';
	import type { GroupDragView } from '$lib/utils/grid';
	import GroupGrid from './GroupGrid.svelte';

	let { item, allServices, onedit, onremove, ondragitem, dragView, selectedChildIds, gridGap = 12, query, matchingIds }: {
		item: StandardGroupItem;
		allServices: Service[];
		onedit?: (service: Service) => void;
		onremove?: (itemId: string) => void;
		ondragitem?: (e: PointerEvent, child: DashboardItemType) => void;
		dragView?: GroupDragView | null;
		selectedChildIds?: Set<string>;
		ontogglechild?: (groupId: string, childId: string, multiSelect: boolean) => void;
		gridGap?: number;
		query?: string;
		matchingIds?: Set<string>;
	} = $props();

	let showEditModal = $state(false);
	let editTitle = $state('');
	let editCompact = $state(false);
	let editOutlineColor = $state('');
	let editScroll = $state<GroupScroll | ''>('');

	const compact = $derived(item.config?.compact ?? false);
	const outlineStyle = $derived(item.config?.outlineColor ? `border-color: ${item.config.outlineColor};` : '');

	function openEditModal() {
		editTitle = item.title;
		editCompact = item.config?.compact ?? false;
		editOutlineColor = item.config?.outlineColor ?? '';
		editScroll = item.config?.scroll ?? '';
		showEditModal = true;
	}

	async function handleSaveEdit() {
		showEditModal = false;
		const updates: Record<string, unknown> = { title: editTitle.trim() || item.title };
		updates.config = { ...item.config, compact: editCompact, outlineColor: editOutlineColor || undefined, scroll: editScroll || undefined };
		await updateDashboardItem(item.id, updates as any);
	}
</script>

<div class="group standard" class:compact style={outlineStyle} data-group-id={item.id}>
	{#if !compact}
		<div class="group-header">
			<span class="group-title">{item.title}</span>
			{#if item.config?.scroll}
				<span class="scroll-hint" title={item.config.scroll === 'vertical' ? 'Scrolls vertically' : 'Scrolls horizontally'}>
					{item.config.scroll === 'vertical' ? '↕' : '↔'}
				</span>
			{/if}
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
		<div class="edit-overlay" role="presentation" onclick={() => (showEditModal = false)} onkeydown={(e) => e.key === 'Escape' && (showEditModal = false)}></div>
		<div class="edit-modal">
			<h3>Edit Group</h3>
			<div class="field">
				<label for="sg-title-{item.id}">Title</label>
				<input id="sg-title-{item.id}" type="text" bind:value={editTitle} placeholder="Group name" />
			</div>
			<label class="toggle-switch">
				<input type="checkbox" bind:checked={editCompact} />
				<span class="toggle-slider"></span>
				<span class="toggle-label">Compact mode (no header)</span>
			</label>
			<div class="field">
				<label for="sg-scroll-{item.id}">Content</label>
				<select id="sg-scroll-{item.id}" bind:value={editScroll}>
					<option value="">Fixed size (fits the group)</option>
					<option value="vertical">Scroll vertically (more rows)</option>
					<option value="horizontal">Scroll horizontally (more columns)</option>
				</select>
				{#if editScroll}
					<p class="field-hint">Cells keep their size; drop tiles past the edge to extend the group's content. Scroll with the wheel or by swiping.</p>
				{/if}
			</div>
			<div class="field">
				<label for="sg-color-{item.id}">Outline color</label>
				<div class="color-row">
					<input id="sg-color-{item.id}" type="color" bind:value={editOutlineColor} />
					{#if editOutlineColor}
						<button class="btn-clear-color" onclick={() => (editOutlineColor = '')} title="Clear color" aria-label="Clear color">
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
	<GroupGrid {item} {allServices} {onedit} {onremove} {ondragitem} {dragView} {selectedChildIds} {gridGap} {query} {matchingIds} />
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

	.scroll-hint {
		font-size: 0.8rem;
		color: var(--text-muted);
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
		min-width: 280px;
		max-width: 360px;
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

	.field input[type="text"],
	.field select {
		width: 100%;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.field input[type="text"]:focus,
	.field select:focus {
		border-color: var(--accent);
	}

	.field-hint {
		margin: 6px 0 0;
		font-size: 0.75rem;
		color: var(--text-muted);
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
</style>
