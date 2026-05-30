<script lang="ts">
	import { isEditing, layout, activeBreakpointId, manualBreakpointId, settings, saveNavbarLayout, removeNavbarItem, getBreakpointLabel, searchQuery, services } from '$lib/stores/dashboard';
	import type { NavbarItem } from '$lib/types';
	import NavbarTitle from './navbar/NavbarTitle.svelte';
	import NavbarSearch from './navbar/NavbarSearch.svelte';
	import NavbarCpuWidget from './navbar/NavbarCpuWidget.svelte';
	import NavbarRamWidget from './navbar/NavbarRamWidget.svelte';
	import NavbarDiskWidget from './navbar/NavbarDiskWidget.svelte';
	import NavbarUptimeKumaStatusPage from './navbar/NavbarUptimeKumaStatusPage.svelte';
	import NavbarDocker from './navbar/NavbarDocker.svelte';
	import NavbarAdGuardControl from './navbar/NavbarAdGuardControl.svelte';
	import NavbarEditModal from './NavbarEditModal.svelte';
	import OptionsDropdown from './OptionsDropdown.svelte';

	let { onadd, onsettings, onlogout }: { onadd?: () => void; onsettings: () => void; onlogout: () => void } = $props();

	function toggleEdit() {
		if (!$isEditing) {
			manualBreakpointId.set($activeBreakpointId);
		} else {
			manualBreakpointId.set(null);
		}
		isEditing.update((v) => !v);
	}

	function handleSearchEnter(query: string) {
		const q = query.trim().toLowerCase();
		if (!q) return;
		const hasMatch = $services.some((s) => s.name.toLowerCase().includes(q));
		if (!hasMatch) {
			window.open(`https://duckduckgo.com/?q=${encodeURIComponent(query.trim())}`, '_blank');
		}
	}

	let dragState = $state<{
		itemId: string;
		startMouseX: number;
		startCol: number;
		currentCol: number;
		colSpan: number;
	} | null>(null);

	let resizeState = $state<{
		itemId: string;
		startMouseX: number;
		startColSpan: number;
		currentColSpan: number;
	} | null>(null);

	let navbarEl: HTMLElement | undefined = $state();
	let editingItem = $state<NavbarItem | null>(null);

	let activeNavbar = $derived($layout?.layouts?.[$activeBreakpointId]?.navbar || { columns: 12, items: [] });

	function getNavbarColumns(): number {
		return activeNavbar.columns || 12;
	}

	function getColumnWidth(): number {
		if (!navbarEl) return 80;
		return navbarEl.getBoundingClientRect().width / getNavbarColumns();
	}

	function handlePointerDownOnItem(e: PointerEvent, item: NavbarItem) {
		if (!$isEditing) return;
		if (resizeState) return;
		if ((e.target as HTMLElement).closest('.navbar-resize-handle, .navbar-delete-btn, .navbar-edit-btn')) return;
		e.preventDefault();

		dragState = {
			itemId: item.id,
			startMouseX: e.clientX,
			startCol: item.col,
			currentCol: item.col,
			colSpan: item.colSpan
		};
	}

	function handlePointerDownOnResize(e: PointerEvent, item: NavbarItem) {
		if (!$isEditing) return;
		e.preventDefault();
		e.stopPropagation();
		resizeState = {
			itemId: item.id,
			startMouseX: e.clientX,
			startColSpan: item.colSpan,
			currentColSpan: item.colSpan
		};
	}

	function handlePointerMove(e: PointerEvent) {
		if (dragState) {
			const colWidth = getColumnWidth();
			const deltaCol = Math.round((e.clientX - dragState.startMouseX) / colWidth);
			const newCol = Math.max(0, Math.min(dragState.startCol + deltaCol, getNavbarColumns() - dragState.colSpan));
			dragState.currentCol = newCol;
		} else if (resizeState) {
			const rs = resizeState;
			const colWidth = getColumnWidth();
			const deltaCol = Math.round((e.clientX - rs.startMouseX) / colWidth);
			const maxSpan = getNavbarColumns() - ((activeNavbar?.items.find(i => i.id === rs.itemId)?.col) ?? 0);
			rs.currentColSpan = Math.max(1, Math.min(rs.startColSpan + deltaCol, maxSpan));
		}
	}

	function handlePointerUp() {
		if (dragState) {
			const ds = dragState;
			const items = [ ...(activeNavbar?.items || []) ];
			const item = items.find(i => i.id === ds.itemId);
			if (item && item.col !== ds.currentCol) {
				item.col = ds.currentCol;
				const sorted = items.sort((a, b) => a.col - b.col);
				let nextCol = 0;
				for (const sortedItem of sorted) {
					if (sortedItem.col < nextCol) sortedItem.col = nextCol;
					nextCol = sortedItem.col + sortedItem.colSpan;
				}
				saveNavbarLayout({ ...activeNavbar!, items: sorted });
			}
			dragState = null;
		} else if (resizeState) {
			const rs = resizeState;
			const items = [ ...(activeNavbar?.items || []) ];
			const item = items.find(i => i.id === rs.itemId);
			if (item && item.colSpan !== rs.currentColSpan) {
				item.colSpan = rs.currentColSpan;
				saveNavbarLayout({ ...activeNavbar!, items });
			}
			resizeState = null;
		}
	}

	async function handleDelete(itemId: string) {
		await removeNavbarItem(itemId);
	}

	function handleEdit(item: NavbarItem) {
		editingItem = item;
	}
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

<header class="navbar" class:editing={$isEditing} class:dragging={!!dragState} class:resizing={!!resizeState}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={navbarEl}
		class="navbar-items"
		style="grid-template-columns: repeat({activeNavbar?.columns || 12}, 1fr);"
	>
		{#each activeNavbar?.items || [] as item (item.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="navbar-item"
				class:editing={$isEditing}
				class:dragging={dragState?.itemId === item.id}
				style="grid-column: {dragState?.itemId === item.id ? dragState.currentCol + 1 : item.col + 1} / span {resizeState?.itemId === item.id ? resizeState.currentColSpan : item.colSpan};"
				onpointerdown={(e) => handlePointerDownOnItem(e, item)}
			>
				{#if item.type === 'navbar-title'}
					<NavbarTitle />
				{:else if item.type === 'navbar-search'}
					<NavbarSearch
						placeholder={item.placeholder}
						onsearch={(q, isEnter) => {
							searchQuery.set(q);
							if (isEnter) handleSearchEnter(q);
						}}
					/>
				{:else if item.type === 'navbar-cpu'}
					<NavbarCpuWidget colSpan={resizeState?.itemId === item.id ? resizeState.currentColSpan : item.colSpan} config={item.config} />
				{:else if item.type === 'navbar-ram'}
					<NavbarRamWidget colSpan={resizeState?.itemId === item.id ? resizeState.currentColSpan : item.colSpan} />
				{:else if item.type === 'navbar-disk'}
					<NavbarDiskWidget config={item.config} colSpan={resizeState?.itemId === item.id ? resizeState.currentColSpan : item.colSpan} />
				{:else if item.type === 'navbar-uptime-kuma-status-page'}
					<NavbarUptimeKumaStatusPage config={item.config} colSpan={resizeState?.itemId === item.id ? resizeState.currentColSpan : item.colSpan} />
				{:else if item.type === 'navbar-docker'}
					<NavbarDocker config={item.config} colSpan={resizeState?.itemId === item.id ? resizeState.currentColSpan : item.colSpan} />
				{:else if item.type === 'navbar-adguard-home-control'}
					<NavbarAdGuardControl config={item.config} />
				{/if}
				{#if $isEditing}
					<button class="navbar-delete-btn" onclick={() => handleDelete(item.id)} title="Remove">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
					<button class="navbar-edit-btn" onclick={() => handleEdit(item)} title="Edit">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
						</svg>
					</button>
					<div class="navbar-resize-handle" onpointerdown={(e) => handlePointerDownOnResize(e, item)}>
						<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
							<circle cx="2.5" cy="3" r="1.2" />
							<circle cx="7.5" cy="3" r="1.2" />
							<circle cx="2.5" cy="7" r="1.2" />
							<circle cx="7.5" cy="7" r="1.2" />
							<circle cx="2.5" cy="11" r="1.2" />
							<circle cx="7.5" cy="11" r="1.2" />
						</svg>
					</div>
				{/if}
			</div>
		{/each}
	</div>
	<div class="navbar-controls">
					{#if $isEditing}
				<div class="layout-select-wrapper">
					<select class="layout-select" onchange={(e) => manualBreakpointId.set(e.currentTarget.value)} value={$manualBreakpointId || $activeBreakpointId}>
						{#each $layout?.grid?.breakpoints || [] as bp}
							<option value={bp.id}>{getBreakpointLabel($layout.grid.breakpoints, bp.id)}</option>
						{/each}
					</select>
				</div>
				<button class="btn-add" onclick={() => onadd?.()} title="Add service or widget">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 5v14M5 12h14" />
					</svg>
					<span>Add</span>
				</button>
			{/if}
		<button class="btn-edit-toggle" class:active={$isEditing} onclick={toggleEdit} title="Toggle edit mode">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
			<span>Edit</span>
		</button>
		<OptionsDropdown {onsettings} {onlogout} />
	</div>
</header>

{#if editingItem}
	<NavbarEditModal item={editingItem} onclose={() => (editingItem = null)} />
{/if}

<style>
	.navbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
	}

	.navbar.dragging,
	.navbar.resizing {
		user-select: none;
	}

	.navbar-items {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-auto-rows: 44px;
		gap: 4px;
		align-items: center;
	}

	.navbar-item {
		position: relative;
		min-width: 0;
		overflow: visible;
		border-radius: var(--radius-sm);
	}

	.navbar-item.editing {
		cursor: grab;
		outline: 1px dashed var(--border-light);
		outline-offset: -1px;
	}

	.navbar-item.editing:active {
		cursor: grabbing;
	}

	.navbar-item.dragging {
		opacity: 0.6;
	}

	.navbar-delete-btn {
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
		opacity: 0;
		transition: opacity var(--transition);
		z-index: 10;
	}

	.navbar-edit-btn {
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
		opacity: 0;
		transition: opacity var(--transition);
		z-index: 10;
	}

	.navbar-item.editing:hover .navbar-delete-btn,
	.navbar-item.editing:hover .navbar-edit-btn {
		opacity: 1;
	}

	.navbar-resize-handle {
		position: absolute;
		top: 0;
		right: 0;
		width: 20px;
		height: 100%;
		cursor: ew-resize;
		z-index: 6;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.navbar-resize-handle svg {
		opacity: 0;
		transition: opacity var(--transition);
		color: var(--text-muted);
	}

	.navbar-item.editing .navbar-resize-handle svg {
		opacity: 0.5;
	}

	.navbar-resize-handle:hover svg {
		opacity: 1 !important;
		color: var(--accent);
	}

	.navbar-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.btn-add {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		background: var(--accent);
		color: white;
		border-radius: var(--radius-sm);
		font-weight: 500;
		font-size: 0.9rem;
		transition: background var(--transition);
	}

	.btn-add:hover {
		background: var(--accent-hover);
	}

	.btn-edit-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-weight: 500;
		font-size: 0.9rem;
		transition: all var(--transition);
	}

	.btn-edit-toggle:hover {
		border-color: var(--accent);
	}

	.btn-edit-toggle.active {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	@media (max-width: 640px) {
		.navbar {
			flex-direction: column;
			align-items: stretch;
		}

		.navbar-controls {
			justify-content: flex-end;
		}
	}

	.layout-select-wrapper {
		display: flex;
		align-items: center;
	}

	.layout-select {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		color: var(--text-primary);
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		min-width: 120px;
	}

	.layout-select:focus {
		outline: none;
		border-color: var(--accent);
	}
</style>