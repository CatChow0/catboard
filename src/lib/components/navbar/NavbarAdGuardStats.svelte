<script lang="ts">
	import type { AdGuardHomeConfig } from '$lib/types';
	import { adguardHomeData } from '$lib/stores/dashboard';

	let { config }: { config: AdGuardHomeConfig } = $props();

	const instanceId = $derived(config?.instanceId || 'default');
	const data = $derived($adguardHomeData[instanceId]);

	const total = $derived(data?.stats.dnsQueries ?? 0);
	const blocked = $derived(data?.stats.blockedQueries ?? 0);
	const pct = $derived(total > 0 ? Math.round((blocked / total) * 100) : 0);
</script>

<div class="navbar-adguard-stats" title="{blocked.toLocaleString()} blocked / {total.toLocaleString()} queries">
	{#if data}
		<div class="bar-track">
			<div class="bar-fill" style:width="{pct}%"></div>
			<span class="bar-text">{pct}% blocked</span>
		</div>
	{:else}
		<span class="no-data">AdGuard</span>
	{/if}
</div>

<style>
	.navbar-adguard-stats {
		display: flex;
		align-items: center;
		padding: 0 8px;
		font-size: 0.75rem;
		white-space: nowrap;
		min-width: 0;
		flex: 1;
	}

	.bar-track {
		position: relative;
		width: 100%;
		max-width: 140px;
		height: 14px;
		background: var(--bg-primary);
		border-radius: 7px;
		overflow: hidden;
		border: 1px solid var(--border);
	}

	.bar-fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: var(--danger);
		border-radius: 7px;
		transition: width 0.3s ease;
		opacity: 0.9;
	}

	.bar-text {
		position: relative;
		z-index: 1;
		display: block;
		width: 100%;
		text-align: center;
		font-size: 0.65rem;
		font-weight: 600;
		line-height: 14px;
		color: var(--text-primary);
		padding: 0 4px;
	}

	.no-data {
		color: var(--text-muted);
		font-size: 0.75rem;
	}
</style>
