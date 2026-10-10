<script lang="ts">
	// Uptime Kuma status page summary, overall bar and monitor list. Shared by
	// the standard widget and the navbar popover so both show the same thing.
	import type { UptimeKumaStatusPageData } from '$lib/types';
	import UptimeKumaLogo from '../icons/UptimeKumaLogo.svelte';

	let { data, showBar = true, showList = true }: { data: UptimeKumaStatusPageData; showBar?: boolean; showList?: boolean } = $props();

	function uptimeColor(pct: number): string {
		if (pct >= 99) return 'var(--success)';
		if (pct >= 95) return 'var(--warning)';
		return 'var(--danger)';
	}
</script>

<div class="uk-content">
	<div class="uk-title">
		<span class="uk-logo"><UptimeKumaLogo size={15} /></span>
		<span class="uk-name">{data.title}</span>
	</div>
	<div class="uk-summary">
		<span class="uk-badge active">{data.activeCount} up</span>
		<span class="uk-badge inactive">{data.inactiveCount} down</span>
		<span class="uk-uptime" style="color: {uptimeColor(data.overallUptime)}">{data.overallUptime}%</span>
	</div>
	{#if showBar}
		<div class="uk-bar-track">
			<div class="uk-bar-fill" style="width: {data.overallUptime}%; background: {uptimeColor(data.overallUptime)};"></div>
		</div>
	{/if}
	{#if showList && data.monitors.length > 0}
		<div class="uk-monitors">
			{#each data.monitors as mon (mon.id)}
				<div class="uk-monitor">
					<span class="uk-monitor-dot" class:up={mon.status === 1} class:down={mon.status !== 1}></span>
					<span class="uk-monitor-name">{mon.name}</span>
					<span class="uk-monitor-uptime" style="color: {uptimeColor(mon.uptime24h)}">{mon.uptime24h}%</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.uk-content {
		display: flex;
		flex-direction: column;
		padding: 12px;
		width: 100%;
		min-width: 0;
		gap: 8px;
		max-height: 100%;
	}

	.uk-title {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.uk-logo {
		display: flex;
		flex-shrink: 0;
		color: var(--text-secondary);
	}

	.uk-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.uk-summary {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.uk-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
		white-space: nowrap;
	}

	.uk-badge.active {
		background: color-mix(in srgb, var(--success) 20%, transparent);
		color: var(--success);
	}

	.uk-badge.inactive {
		background: color-mix(in srgb, var(--danger) 20%, transparent);
		color: var(--danger);
	}

	.uk-uptime {
		font-size: 0.8rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.uk-bar-track {
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
		flex-shrink: 0;
	}

	.uk-bar-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.uk-monitors {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.uk-monitor {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
	}

	.uk-monitor-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.uk-monitor-dot.up {
		background: var(--success);
	}

	.uk-monitor-dot.down {
		background: var(--danger);
	}

	.uk-monitor-name {
		flex: 1;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.uk-monitor-uptime {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}
</style>
