<script lang="ts">
	import type { AdGuardHomeConfig } from '$lib/types';
	import { adguardHomeData, isEditing } from '$lib/stores/dashboard';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: AdGuardHomeConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const instanceId = $derived(config?.instanceId || 'default');
	const data = $derived($adguardHomeData[instanceId]);
	const cells = $derived(colSpan * rowSpan);
	const showAll = $derived(cells >= 4);
</script>

<div class="adguard-stats-tile">
	{#if !data}
		<div class="adguard-placeholder">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
				<path d="M12 6v6l4 2" />
			</svg>
			<span>No data</span>
		</div>
	{:else}
		<div class="adguard-grid" class:compact={!showAll}>
			<div class="stat-card queries">
				<span class="stat-value">{data.stats.dnsQueries.toLocaleString()}</span>
				<span class="stat-label">Queries</span>
			</div>
			<div class="stat-card blocked">
				<span class="stat-value">{data.stats.blockedQueries.toLocaleString()}</span>
				<span class="stat-label">Blocked</span>
			</div>
			{#if showAll}
				<div class="stat-card domains">
					<span class="stat-value">{data.stats.blockedDomains.toLocaleString()}</span>
					<span class="stat-label">Domains</span>
				</div>
				<div class="stat-card latency">
					<span class="stat-value">{(data.stats.avgProcessingTime * 1000).toFixed(0)}ms</span>
					<span class="stat-label">Latency</span>
				</div>
			{/if}
		</div>
	{/if}
	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title="Remove AdGuard stats">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.adguard-stats-tile {
		position: relative;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: visible;
		padding: 6px;
	}

	.adguard-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.adguard-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		width: 100%;
		height: 100%;
	}

	.adguard-grid.compact {
		gap: 4px;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		border-radius: var(--radius-sm);
		padding: 6px;
		min-width: 0;
	}

	.stat-card.queries {
		background: rgba(52, 152, 219, 0.12);
		color: #3498db;
	}

	.stat-card.blocked {
		background: rgba(231, 76, 60, 0.12);
		color: #e74c3c;
	}

	.stat-card.domains {
		background: rgba(241, 196, 15, 0.12);
		color: #f1c40f;
	}

	.stat-card.latency {
		background: rgba(46, 204, 113, 0.12);
		color: #2ecc71;
	}

	.stat-value {
		font-size: 0.9rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
		white-space: nowrap;
	}

	.stat-label {
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.8;
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

	.adguard-stats-tile:hover .btn-delete {
		opacity: 1;
	}

	.btn-delete:hover {
		background: #c0392b;
	}
</style>
