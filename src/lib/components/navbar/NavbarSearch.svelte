<script lang="ts">
	// Navbar search. Typing highlights matching tiles on the dashboard shown (via
	// onsearch) and lists matches from EVERY dashboard under the field, grouped by
	// dashboard. ↑ ↓ pick a result, Enter opens it (switching dashboard if needed);
	// with no match anywhere, Enter searches the web (onsearch with isEnter).
	import { services, activeDashboardId, searchQuery as searchStore, fetchSearchIndex, revealItem } from '$lib/stores/dashboard';
	import { searchDashboards, type SearchHit } from '$lib/utils/search';
	import type { DashboardItem } from '$lib/types';

	let {
		placeholder = 'Search services...',
		onsearch
	}: {
		placeholder?: string;
		onsearch?: (query: string, isEnter: boolean) => void;
	} = $props();

	const PER_GROUP = 6;

	let searchQuery = $state('');
	let focused = $state(false);
	let index = $state<{ id: string; name: string; items: DashboardItem[] }[]>([]);
	let selected = $state(0);

	const groups = $derived(searchDashboards(index, searchQuery, $services, $activeDashboardId));
	/** Results in display order (what ↑ ↓ walk through). */
	const flat = $derived(groups.flatMap((g) => g.hits.slice(0, PER_GROUP)));
	const open = $derived(focused && searchQuery.trim().length > 0);

	// Cleared elsewhere (dashboard switch): clear the field too.
	$effect(() => {
		if ($searchStore === '' && searchQuery !== '' && !focused) searchQuery = '';
	});

	async function loadIndex() {
		try {
			index = await fetchSearchIndex();
		} catch {
			index = [];
		}
	}

	function handleFocus() {
		focused = true;
		void loadIndex();
	}

	function handleInput() {
		selected = 0;
		onsearch?.(searchQuery, false);
	}

	function pick(hit: SearchHit) {
		focused = false;
		(document.activeElement as HTMLElement | null)?.blur();
		void revealItem(hit.dashboardId, hit.itemId);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' && flat.length) {
			e.preventDefault();
			selected = (selected + 1) % flat.length;
		} else if (e.key === 'ArrowUp' && flat.length) {
			e.preventDefault();
			selected = (selected - 1 + flat.length) % flat.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (flat.length) pick(flat[Math.min(selected, flat.length - 1)]);
			else onsearch?.(searchQuery, true);
		} else if (e.key === 'Escape') {
			searchQuery = '';
			onsearch?.('', false);
			(e.currentTarget as HTMLInputElement).blur();
		}
	}
</script>

<div class="search-wrap">
	<div class="search-box">
		<svg style="width: calc(16px * var(--nb-icon, 1)); height: calc(16px * var(--nb-icon, 1))" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="11" cy="11" r="8" />
			<path d="M21 21l-4.35-4.35" />
		</svg>
		<input
			type="text"
			{placeholder}
			bind:value={searchQuery}
			oninput={handleInput}
			onkeydown={handleKeyDown}
			onfocus={handleFocus}
			onblur={() => setTimeout(() => (focused = false), 150)}
			role="combobox"
			aria-expanded={open}
			aria-controls="nb-search-results"
			aria-autocomplete="list"
		/>
	</div>

	{#if open}
		<div class="results" id="nb-search-results" role="listbox">
			{#if groups.length === 0}
				<p class="empty">No tile found. Press Enter to search the web.</p>
			{:else}
				{#each groups as g (g.dashboardId)}
					<div class="group">
						<div class="group-name">
							{g.dashboardName}{#if g.dashboardId === $activeDashboardId}<span class="here">this dashboard</span>{/if}
						</div>
						{#each g.hits.slice(0, PER_GROUP) as hit (hit.itemId)}
							{@const i = flat.indexOf(hit)}
							<button
								type="button"
								class="hit"
								class:active={i === selected}
								role="option"
								aria-selected={i === selected}
								onpointerdown={(e) => e.preventDefault()}
								onpointerenter={() => (selected = i)}
								onclick={() => pick(hit)}
							>
								<span class="hit-label">{hit.label}</span>
								{#if hit.group}<span class="hit-group">in {hit.group}</span>{/if}
							</button>
						{/each}
						{#if g.hits.length > PER_GROUP}<div class="more">+{g.hits.length - PER_GROUP} more</div>{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.search-wrap {
		position: relative;
		width: 100%;
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		transition: border-color var(--transition);
		width: 100%;
	}

	.search-box:focus-within {
		border-color: var(--accent);
	}

	.search-box svg {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.search-box input {
		background: none;
		border: none;
		outline: none;
		width: 100%;
		padding: 0;
		color: var(--text-primary);
		font-size: calc(0.9rem * var(--nb-text, 1));
	}

	.results {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		min-width: 260px;
		max-height: min(60vh, 420px);
		overflow-y: auto;
		z-index: 1500;
		padding: 6px;
		border-radius: var(--radius);
		background: var(--bg-modal);
		border: 1px solid var(--border);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
		scrollbar-width: thin;
	}

	.group + .group {
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid var(--border);
	}

	.group-name {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		font-size: 0.66rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.here {
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
		color: var(--accent);
	}

	.hit {
		display: flex;
		align-items: baseline;
		gap: 8px;
		width: 100%;
		padding: 7px 10px;
		border-radius: var(--radius-sm);
		text-align: left;
		background: none;
		color: var(--text-primary);
		font-size: 0.84rem;
	}

	.hit.active {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.hit-label {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.hit-group {
		flex-shrink: 0;
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.more,
	.empty {
		margin: 0;
		padding: 4px 10px;
		font-size: 0.72rem;
		color: var(--text-muted);
	}
</style>
