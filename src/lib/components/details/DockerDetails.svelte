<script lang="ts">
	// Docker environment summary and container list. Shared by the standard
	// Docker widget and the navbar Docker popover so both show the same thing.
	// With showCpu / showRam, running containers also show their usage (the
	// server only collects it when a widget of the environment asks for it).
	import type { DockerContainerInfo, DockerEnvironmentData } from '$lib/types';
	import DockerLogo from '../icons/DockerLogo.svelte';
	import { bytes } from '../stacker/format';

	let { data, showList = true, showCpu = false, showRam = false }: {
		data: DockerEnvironmentData;
		showList?: boolean;
		showCpu?: boolean;
		showRam?: boolean;
	} = $props();

	const hasStats = $derived(!!data.stats && (showCpu || showRam));

	function statusColor(status: DockerContainerInfo['status']): string {
		if (status === 'running') return 'var(--success)';
		if (status === 'paused' || status === 'restarting') return 'var(--warning)';
		return 'var(--danger)';
	}

	function statusLabel(status: DockerContainerInfo['status']): string {
		if (status === 'running') return 'running';
		if (status === 'paused') return 'paused';
		if (status === 'restarting') return 'restarting';
		if (status === 'dead') return 'dead';
		return 'stopped';
	}

	const cpu = (v: number | undefined) => (v == null ? '…' : `${v < 10 ? v.toFixed(1) : Math.round(v)}%`);
	const memTitle = (c: DockerContainerInfo) =>
		c.memUsage != null && c.memLimit ? `${bytes(c.memUsage)} of ${bytes(c.memLimit)} (${((c.memUsage / c.memLimit) * 100).toFixed(1)}%)` : undefined;
</script>

<div class="docker-content">
	<div class="docker-title">
		<span class="docker-logo"><DockerLogo size={15} /></span>
		<span class="docker-name">{data.name}</span>
	</div>
	<div class="docker-summary">
		<span class="docker-badge active">{data.runningCount} running</span>
		<span class="docker-badge inactive">{data.stoppedCount} stopped</span>
		{#if hasStats && data.stats}
			<span class="docker-totals">
				{#if showCpu}<span title="CPU of all running containers (100% = one core)">CPU {cpu(data.stats.cpuPercent)}</span>{/if}
				{#if showRam}<span title="Memory of all running containers">RAM {bytes(data.stats.memUsage)}</span>{/if}
			</span>
		{/if}
	</div>
	{#if showList && data.containers.length > 0}
		<div class="docker-containers">
			{#each data.containers as container (container.id)}
				<div class="docker-container">
					<span class="docker-container-dot" style="background: {statusColor(container.status)};"></span>
					<span class="docker-container-name" title={container.image}>{container.name}</span>
					{#if hasStats && container.status === 'running'}
						{#if showCpu}<span class="docker-stat cpu" title="CPU (100% = one core)">{cpu(container.cpuPercent)}</span>{/if}
						{#if showRam}<span class="docker-stat ram" title={memTitle(container)}>{container.memUsage != null ? bytes(container.memUsage) : '…'}</span>{/if}
					{:else}
						<span class="docker-container-status" style="color: {statusColor(container.status)}">{statusLabel(container.status)}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.docker-content {
		display: flex;
		flex-direction: column;
		padding: 12px;
		width: 100%;
		min-width: 0;
		max-height: 100%;
		overflow-y: auto;
		gap: 8px;
	}

	.docker-title {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.docker-logo {
		display: flex;
		flex-shrink: 0;
		color: var(--text-secondary);
	}

	.docker-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.docker-summary {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.docker-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
		white-space: nowrap;
	}

	.docker-badge.active {
		background: color-mix(in srgb, var(--success) 20%, transparent);
		color: var(--success);
	}

	.docker-badge.inactive {
		background: color-mix(in srgb, var(--danger) 20%, transparent);
		color: var(--danger);
	}

	.docker-totals {
		display: flex;
		gap: 8px;
		margin-left: auto;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.docker-containers {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.docker-container {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
	}

	.docker-container-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.docker-container-name {
		flex: 1;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.docker-container-status {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
		font-size: 0.7rem;
	}

	.docker-stat {
		flex-shrink: 0;
		font-size: 0.7rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-align: right;
		color: var(--text-primary);
	}

	.docker-stat.cpu {
		min-width: 40px;
	}

	.docker-stat.ram {
		min-width: 58px;
	}
</style>
