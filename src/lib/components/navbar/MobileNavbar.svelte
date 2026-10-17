<script lang="ts">
	// Phone navbar: a top bar (title + dashboard squares, search, menu) and a
	// horizontally scrolling strip with the other navbar widgets of the active
	// breakpoint, in column order. In edit mode, tapping a strip widget selects it
	// and an action row lets you move, resize, edit or remove it.
	import { isEditing, layout, activeBreakpointId, saveNavbarLayout, removeNavbarItem, searchQuery } from '$lib/stores/dashboard';
	import type { NavbarItem, NavbarLayout } from '$lib/types';
	import NavbarTitle from './NavbarTitle.svelte';
	import NavbarSearch from './NavbarSearch.svelte';
	import NavbarWidget from './NavbarWidget.svelte';
	import MobileMenuSheet from './MobileMenuSheet.svelte';
	import NavbarEditModal from '../NavbarEditModal.svelte';

	let { onadd, onsettings, onlogout, onsearchenter }: {
		onadd?: () => void;
		onsettings: () => void;
		onlogout: () => void;
		onsearchenter: (query: string) => void;
	} = $props();

	const STRIP_UNIT = 88;

	let menuOpen = $state(false);
	let searchOpen = $state(false);
	let selectedId = $state<string | null>(null);
	let editingItem = $state<NavbarItem | null>(null);
	let sizePreview = $state<{ id: string; iconScale: number; textScale: number } | null>(null);

	const navbar = $derived<NavbarLayout>($layout?.layouts?.[$activeBreakpointId]?.navbar || { columns: 12, items: [] });
	const columns = $derived(navbar.columns || 12);
	const sorted = $derived([...navbar.items].sort((a, b) => a.col - b.col));
	const searchItem = $derived(navbar.items.find((i) => i.type === 'navbar-search'));
	const titleItem = $derived(navbar.items.find((i) => i.type === 'navbar-title'));
	const stripItems = $derived(sorted.filter((i) => i.type !== 'navbar-title' && i.type !== 'navbar-search'));
	const selected = $derived(stripItems.find((i) => i.id === selectedId) ?? null);

	// Leaving edit mode clears the selection; a removed item can't stay selected.
	$effect(() => {
		if (!$isEditing || (selectedId && !stripItems.some((i) => i.id === selectedId))) selectedId = null;
	});

	function scaleVars(item: NavbarItem): string {
		const p = sizePreview?.id === item.id ? sizePreview : null;
		const icon = (p?.iconScale ?? item.iconScale ?? 100) / 100;
		const text = (p?.textScale ?? item.textScale ?? 100) / 100;
		return `--nb-icon: ${icon}; --nb-text: ${text};`;
	}

	/** Title sizes, with the dashboard squares enlarged 1.5x for fingers. */
	function titleVars(item: NavbarItem | undefined): string {
		const icon = ((item?.iconScale ?? 100) / 100) * 1.5;
		const text = (item?.textScale ?? 100) / 100;
		return `--nb-icon: ${icon}; --nb-text: ${text};`;
	}

	function itemWidth(item: NavbarItem): string {
		return `width: clamp(96px, ${item.colSpan * STRIP_UNIT}px, 85vw);`;
	}

	function save(items: NavbarItem[]) {
		void saveNavbarLayout({ ...navbar, items });
	}

	/** Swap a strip widget with its neighbour in the strip, keeping the columns they cover. */
	function move(dir: -1 | 1) {
		if (!selected) return;
		const i = stripItems.findIndex((it) => it.id === selected.id);
		const other = stripItems[i + dir];
		if (!other) return;
		const [first, second] = dir === 1 ? [selected, other] : [other, selected];
		const gap = second.col - (first.col + first.colSpan);
		const items = navbar.items.map((it) => ({ ...it }));
		const a = items.find((it) => it.id === first.id)!;
		const b = items.find((it) => it.id === second.id)!;
		b.col = first.col;
		a.col = first.col + second.colSpan + gap;
		save(items);
	}

	/** Free columns right after the selected widget, plus free columns at the end of the row (followers shift right into those). */
	function roomToGrow(item: NavbarItem): boolean {
		const end = item.col + item.colSpan;
		const next = sorted.find((it) => it.col >= end && it.id !== item.id);
		if (!next || next.col > end) return end < columns;
		const last = sorted[sorted.length - 1];
		return last.col + last.colSpan < columns;
	}

	function resize(delta: -1 | 1) {
		if (!selected) return;
		const items = navbar.items.map((it) => ({ ...it }));
		const me = items.find((it) => it.id === selected.id)!;
		if (delta === -1) {
			if (me.colSpan <= 1) return;
			me.colSpan -= 1;
		} else {
			if (!roomToGrow(me)) return;
			const end = me.col + me.colSpan;
			const blocked = items.some((it) => it.col === end);
			if (blocked) for (const it of items) if (it.col >= end) it.col += 1;
			me.colSpan += 1;
		}
		save(items);
	}

	async function remove() {
		if (!selected) return;
		const id = selected.id;
		selectedId = null;
		await removeNavbarItem(id);
	}

	function handleSearch(q: string, isEnter: boolean) {
		searchQuery.set(q);
		if (isEnter) onsearchenter(q);
	}

	function toggleSearch() {
		searchOpen = !searchOpen;
		if (!searchOpen) searchQuery.set('');
	}
</script>

<header class="mnav" class:editing={$isEditing}>
	<div class="mnav-bar">
		<div class="mnav-title" style={titleVars(titleItem)}>
			<NavbarTitle />
		</div>
		{#if titleItem && $isEditing}
			<button class="mnav-icon" onclick={() => (editingItem = titleItem)} aria-label="Edit title">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
				</svg>
			</button>
		{/if}
		{#if searchItem}
			<button class="mnav-icon" class:active={searchOpen} onclick={toggleSearch} aria-label="Search" aria-expanded={searchOpen}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="11" cy="11" r="8" />
					<path d="M21 21l-4.35-4.35" />
				</svg>
			</button>
		{/if}
		<button class="mnav-icon" class:active={$isEditing} onclick={() => (menuOpen = true)} aria-label="Menu">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<path d="M4 6h16M4 12h16M4 18h16" />
			</svg>
		</button>
	</div>

	{#if searchItem && searchOpen}
		<div class="mnav-search">
			<NavbarSearch placeholder={searchItem.placeholder} onsearch={handleSearch} />
			{#if $isEditing}
				<button class="mnav-chip" onclick={() => (editingItem = searchItem)}>Edit</button>
			{/if}
		</div>
	{/if}

	{#if stripItems.length > 0}
		<div class="mnav-strip">
			{#each stripItems as item (item.id)}
				{#if $isEditing}
					<!-- In edit mode a tap selects; the widget itself must not react. -->
					<button
						class="mnav-cell editing"
						class:selected={selectedId === item.id}
						style="{itemWidth(item)} {scaleVars(item)}"
						aria-pressed={selectedId === item.id}
						onclick={() => (selectedId = selectedId === item.id ? null : item.id)}
					>
						<div class="mnav-cell-inner" inert>
							<NavbarWidget {item} colSpan={item.colSpan} />
						</div>
					</button>
				{:else}
					<div class="mnav-cell" style="{itemWidth(item)} {scaleVars(item)}">
						<NavbarWidget {item} colSpan={item.colSpan} />
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	{#if $isEditing && selected}
		<div class="mnav-actions" role="toolbar" aria-label="Navbar widget">
			<button onclick={() => move(-1)} disabled={stripItems[0]?.id === selected.id} aria-label="Move left">◀</button>
			<button onclick={() => move(1)} disabled={stripItems[stripItems.length - 1]?.id === selected.id} aria-label="Move right">▶</button>
			<button onclick={() => resize(-1)} disabled={selected.colSpan <= 1} aria-label="Narrower">−</button>
			<button onclick={() => resize(1)} disabled={!roomToGrow(selected)} aria-label="Wider">+</button>
			<button onclick={() => (editingItem = selected)}>Edit</button>
			<button class="danger" onclick={remove}>Remove</button>
		</div>
	{/if}
</header>

{#if menuOpen}
	<MobileMenuSheet onclose={() => (menuOpen = false)} {onadd} {onsettings} {onlogout} />
{/if}

{#if editingItem}
	<NavbarEditModal
		item={editingItem}
		onpreview={(iconScale, textScale) => (sizePreview = editingItem ? { id: editingItem.id, iconScale, textScale } : null)}
		onclose={() => {
			editingItem = null;
			sizePreview = null;
		}}
	/>
{/if}

<style>
	.mnav {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
	}

	.mnav-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 48px;
	}

	/* The title gets the whole bar (its squares are enlarged in titleVars). */
	.mnav-title {
		flex: 1;
		min-width: 0;
	}

	.mnav-title :global(.nt-dots) {
		gap: 8px;
		padding: 4px 0;
	}

	.mnav-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		background: var(--bg-card);
		border: 1px solid var(--border-light);
	}

	.mnav-icon.active {
		color: var(--accent);
		border-color: var(--accent);
	}

	.mnav-search {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.mnav-search > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}

	.mnav-strip {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		margin: 0 -12px;
		padding: 2px 12px 4px;
		/* Horizontal swipes here scroll the strip, not the dashboards. */
		touch-action: pan-x pan-y;
	}

	.mnav-strip::-webkit-scrollbar {
		display: none;
	}

	.mnav-cell {
		flex-shrink: 0;
		min-height: 44px;
		display: flex;
		align-items: center;
		scroll-snap-align: start;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--bg-card) 70%, transparent);
		border: 1px solid var(--border);
		text-align: left;
		color: inherit;
		font: inherit;
	}

	.mnav-cell > :global(*),
	.mnav-cell-inner {
		width: 100%;
		min-width: 0;
	}

	.mnav-cell.editing {
		border-style: dashed;
		border-color: var(--border-light);
	}

	.mnav-cell.selected {
		border: 2px solid var(--accent);
	}

	.mnav-actions {
		display: flex;
		gap: 6px;
		overflow-x: auto;
	}

	.mnav-actions button,
	.mnav-chip {
		flex-shrink: 0;
		min-width: 40px;
		height: 38px;
		padding: 0 12px;
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		color: var(--text-primary);
		font-size: 0.9rem;
		font-weight: 600;
	}

	.mnav-actions button:disabled {
		opacity: 0.4;
	}

	.mnav-actions button.danger {
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 50%, transparent);
	}
</style>
