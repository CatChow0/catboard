<script lang="ts">
	import type { JellyfinLatestConfig, JellyfinMediaItem } from '$lib/types';
	import { isEditing, settings } from '$lib/stores/dashboard';
	import { onMount, onDestroy } from 'svelte';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: JellyfinLatestConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const instanceId = $derived(config?.instanceId || 'default');
	const limit = $derived(config?.limit || 5);
	const cells = $derived(colSpan * rowSpan);
	const isCompact = $derived(rowSpan === 1);
	const displayLimit = $derived(cells < 4 ? Math.min(limit, 3) : limit);
	const animLevel = $derived($settings?.animations || 'subtle');

	let items = $state<JellyfinMediaItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let intervalId = $state<ReturnType<typeof setInterval> | null>(null);

	async function fetchData() {
		try {
			const res = await fetch(`/api/integrations/jellyfin/latest?instanceId=${encodeURIComponent(instanceId)}&limit=${displayLimit}`);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				error = err.error || `HTTP ${res.status}`;
				return;
			}
			const data = await res.json();
			if (data.error) {
				error = data.error;
			} else {
				items = data.items || [];
				error = null;
			}
		} catch (e) {
			error = 'Failed to fetch';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchData();
		intervalId = setInterval(fetchData, 60000);
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});

	function getBadgeColor(type: string): string {
		switch (type) {
			case 'Movie': return '#3498db';
			case 'TV Show': return '#2ecc71';
			case 'Episode': return '#e67e22';
			case 'Album': return '#9b59b6';
			case 'Music': return '#e91e63';
			case 'Video': return '#95a5a6';
			case 'Book': return '#8d6e63';
			default: return '#7f8c8d';
		}
	}

	function truncate(text: string, maxLen: number): string {
		if (!text) return '';
		return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
	}
</script>

<div class="jellyfin-tile" class:compact={isCompact} style:--anim="{animLevel === 'none' ? '0s' : animLevel === 'subtle' ? '0.2s' : '0.3s'}">
	{#if loading && items.length === 0}
		<div class="jellyfin-placeholder">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<rect x="2" y="2" width="20" height="20" rx="2.18" />
				<circle cx="12" cy="12" r="5" />
				<path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
			</svg>
			<span>Loading...</span>
		</div>
	{:else if error && items.length === 0}
		<div class="jellyfin-placeholder">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<circle cx="12" cy="12" r="10" />
				<path d="M12 8v4M12 16h.01" />
			</svg>
			<span>{error}</span>
		</div>
	{:else if items.length === 0}
		<div class="jellyfin-placeholder">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<rect x="2" y="2" width="20" height="20" rx="2.18" />
				<circle cx="12" cy="12" r="5" />
				<path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
			</svg>
			<span>No recent items</span>
		</div>
	{:else}
		<div class="jellyfin-list">
			{#each items as item (item.id)}
				<div class="jellyfin-card" style:background-image="url({item.backdropUrl || item.imageUrl || ''})" class:no-image={!item.backdropUrl && !item.imageUrl}>
					<div class="jellyfin-gradient"></div>
					<div class="jellyfin-content">
						<div class="jellyfin-header">
							<span class="jellyfin-badge" style:background={getBadgeColor(item.type)}>{item.type}</span>
							<span class="jellyfin-title">{truncate(item.name, 40)}</span>
						</div>
						{#if !isCompact}
							<p class="jellyfin-desc">{truncate(item.overview, 80)}</p>
							<span class="jellyfin-date">Added {item.dateCreated}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title="Remove Jellyfin Latest">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.jellyfin-tile {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: 8px;
		gap: 6px;
	}

	.jellyfin-tile.compact {
		padding: 4px;
		gap: 4px;
	}

	.jellyfin-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 0.75rem;
		height: 100%;
	}

	.jellyfin-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		overflow-y: auto;
		flex: 1;
	}

	.jellyfin-tile.compact .jellyfin-list {
		gap: 4px;
		overflow: hidden;
	}

	.jellyfin-card {
		position: relative;
		min-height: 0;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		background-size: cover;
		background-position: center;
		overflow: hidden;
		flex: 1;
		display: flex;
		align-items: flex-end;
		transition: transform var(--anim) ease;
	}

	.jellyfin-card:hover {
		transform: scale(1.01);
	}

	.jellyfin-card.no-image {
		background: var(--bg-card-hover);
		border: 1px solid var(--border);
	}

	.jellyfin-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.1) 100%);
		pointer-events: none;
		z-index: 1;
	}

	.jellyfin-card.no-image .jellyfin-gradient {
		background: linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.05) 100%);
	}

	.jellyfin-content {
		position: relative;
		z-index: 2;
		padding: 10px 12px;
		width: 100%;
		min-width: 0;
	}

	.jellyfin-tile.compact .jellyfin-content {
		padding: 6px 8px;
	}

	.jellyfin-header {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		flex-wrap: wrap;
	}

	.jellyfin-badge {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 6px;
		border-radius: 4px;
		color: white;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.jellyfin-title {
		font-weight: 700;
		font-size: 0.85rem;
		color: white;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		flex: 1;
	}

	.jellyfin-tile.compact .jellyfin-title {
		font-size: 0.75rem;
	}

	.jellyfin-desc {
		font-size: 0.7rem;
		color: rgba(255,255,255,0.75);
		margin: 4px 0 0;
		line-height: 1.3;
		display: -webkit-box;
		line-clamp: 2;
			-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.jellyfin-date {
		font-size: 0.65rem;
		color: rgba(255,255,255,0.6);
		margin-top: 4px;
		display: block;
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

	.jellyfin-tile:hover .btn-delete {
		opacity: 1;
	}

	.btn-delete:hover {
		background: #c0392b;
	}
</style>
