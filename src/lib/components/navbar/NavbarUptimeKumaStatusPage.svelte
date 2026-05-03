<script lang="ts">
	import type { UptimeKumaStatusPageConfig } from '$lib/types';
	import { uptimeKumaData } from '$lib/stores/dashboard';

	let { colSpan = 2, config }: { colSpan?: number; config: UptimeKumaStatusPageConfig } = $props();

	const data = $derived($uptimeKumaData[config?.slug || '']);

	function uptimeColor(pct: number): string {
		if (pct >= 99) return 'var(--success)';
		if (pct >= 95) return 'var(--warning)';
		return 'var(--danger)';
	}
</script>

<div class="uk-widget">
	{#if data}
		<span class="uk-dot up"></span>
		<span class="uk-count">{data.activeCount}</span>
		<span class="uk-dot down"></span>
		<span class="uk-count">{data.inactiveCount}</span>
		<span class="uk-dot" style="background: {uptimeColor(data.overallUptime)};"></span>
		<span class="uk-uptime" style="color: {uptimeColor(data.overallUptime)}">{data.overallUptime}%</span>
	{:else}
		<span class="uk-dot pending"></span>
		<span class="uk-loading">...</span>
	{/if}
</div>

<style>
	.uk-widget {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 8px;
		height: 100%;
		white-space: nowrap;
	}

	.uk-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.uk-dot.up {
		background: var(--success);
	}

	.uk-dot.down {
		background: var(--danger);
	}

	.uk-dot.pending {
		background: var(--text-muted);
		opacity: 0.5;
	}

	.uk-count {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.uk-uptime {
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		margin-left: 2px;
	}

	.uk-loading {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
</style>