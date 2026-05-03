<script lang="ts">
	let { value = '', onchange }: {
		value?: string;
		onchange?: (icon: string) => void;
	} = $props();

	let open = $state(false);
	let search = $state('');
	let loading = $state(false);
	let error = $state('');

	interface IconMeta {
		base: string;
		aliases: string[];
		categories: string[];
	}

	let iconData = $state<Record<string, IconMeta>>({});
	let loaded = $state(false);
	let showCount = $state(60);

	const CDN_BASE = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons';

	function iconUrl(name: string): string {
		return `${CDN_BASE}/svg/${name}.svg`;
	}

	async function loadIcons() {
		if (loaded) return;
		loading = true;
		error = '';
		try {
			const res = await fetch('https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/metadata.json');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data: Record<string, IconMeta> = await res.json();
			const svgOnly: Record<string, IconMeta> = {};
			for (const [name, meta] of Object.entries(data)) {
				if (meta.base === 'svg') {
					svgOnly[name] = meta;
				}
			}
			iconData = svgOnly;
			loaded = true;
		} catch (e) {
			error = 'Failed to load icons';
			console.error('IconPicker load error:', e);
		} finally {
			loading = false;
		}
	}

	let allNames = $derived(Object.keys(iconData).sort());

	let filtered = $derived(
		search
			? allNames.filter((name) => {
					const q = search.toLowerCase();
					const meta = iconData[name];
					return (
						name.includes(q) ||
						meta?.aliases.some((a) => a.toLowerCase().includes(q)) ||
						meta?.categories.some((c) => c.toLowerCase().includes(q))
					);
				})
			: allNames
	);

	let visible = $derived(filtered.slice(0, showCount));
	let hasMore = $derived(filtered.length > showCount);

	function selectIcon(name: string) {
		onchange?.(name);
		open = false;
		search = '';
		showCount = 60;
	}

	function loadMore() {
		showCount += 60;
	}

	async function toggleOpen() {
		open = !open;
		if (open && !loaded) {
			await loadIcons();
		}
		if (!open) {
			showCount = 60;
		}
	}
</script>

<div class="icon-picker">
	<div class="selected-icon" onclick={toggleOpen} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleOpen()}>
		{#if value}
			<img src={iconUrl(value)} alt={value} width="24" height="24" onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
			<span class="icon-name">{value}</span>
		{:else}
			<span class="placeholder">Choose icon...</span>
		{/if}
		<svg class="chevron" class:rotated={open} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M6 9l6 6 6-6" />
		</svg>
	</div>

	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
		<div class="dropdown" onclick={(e) => e.stopPropagation()}>
			<div class="search-row">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="11" cy="11" r="8" />
					<path d="M21 21l-4.35-4.35" />
				</svg>
				<input
					type="text"
					placeholder="Search icons, categories..."
					bind:value={search}
					autofocus
				/>
				{#if allNames.length > 0}
					<span class="count">{filtered.length}/{allNames.length}</span>
				{/if}
			</div>

			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<span>Loading icons...</span>
				</div>
			{:else if error}
				<div class="error-state">{error}</div>
			{:else if visible.length > 0}
				<div class="icon-grid">
					{#each visible as name}
						<button
							class="icon-option"
							class:active={value === name}
							onclick={() => selectIcon(name)}
							title={name}
						>
							<img src={iconUrl(name)} alt={name} width="28" height="28" loading="lazy" onerror={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
							<span class="icon-label">{name}</span>
						</button>
					{/each}
				</div>
				{#if hasMore}
					<button class="load-more" onclick={loadMore}>
						Show more ({filtered.length - showCount} remaining)
					</button>
				{/if}
			{:else if loaded}
				<p class="no-results">No icons found</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.icon-picker {
		position: relative;
	}

	.selected-icon {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		user-select: none;
		min-height: 38px;
		transition: border-color var(--transition);
	}

	.selected-icon:hover {
		border-color: var(--accent);
	}

	.selected-icon img {
		flex-shrink: 0;
	}

	.icon-name {
		flex: 1;
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.placeholder {
		flex: 1;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.chevron {
		transition: transform var(--transition);
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 100;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		overflow: hidden;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
	}

	.search-row svg {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.search-row input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		font-size: 0.85rem;
		padding: 0;
	}

	.count {
		font-size: 0.7rem;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-state {
		padding: 16px;
		text-align: center;
		color: var(--danger);
		font-size: 0.85rem;
	}

	.icon-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
		gap: 4px;
		padding: 8px;
		max-height: 280px;
		overflow-y: auto;
	}

	.icon-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px 4px;
		border: 1px solid transparent;
		border-radius: 6px;
		cursor: pointer;
		transition: all var(--transition);
	}

	.icon-option:hover {
		background: var(--bg-card-hover);
		border-color: var(--border-light);
	}

	.icon-option.active {
		background: rgba(79, 143, 255, 0.15);
		border-color: var(--accent);
	}

	.icon-label {
		font-size: 0.65rem;
		color: var(--text-muted);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
	}

	.icon-option.active .icon-label {
		color: var(--accent);
	}

	.load-more {
		width: 100%;
		padding: 8px;
		background: var(--bg-primary);
		border-top: 1px solid var(--border);
		color: var(--text-secondary);
		font-size: 0.8rem;
		cursor: pointer;
	}

	.load-more:hover {
		background: var(--bg-card-hover);
		color: var(--text-primary);
	}

	.no-results {
		text-align: center;
		padding: 16px;
		color: var(--text-muted);
		font-size: 0.85rem;
	}
</style>