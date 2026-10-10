<script lang="ts">
	// Docker environment summary and container list. Shared by the standard
	// Docker widget and the navbar Docker popover so both show the same thing.
	import type { DockerContainerInfo, DockerEnvironmentData } from '$lib/types';
	import DockerLogo from '../icons/DockerLogo.svelte';

	let { data, showList = true }: { data: DockerEnvironmentData; showList?: boolean } = $props();

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
</script>

<div class="docker-content">
	<div class="docker-title">
		<span class="docker-logo"><DockerLogo size={15} /></span>
		<span class="docker-name">{data.name}</span>
	</div>
	<div class="docker-summary">
		<span class="docker-badge active">{data.runningCount} running</span>
		<span class="docker-badge inactive">{data.stoppedCount} stopped</span>
	</div>
	{#if showList && data.containers.length > 0}
		<div class="docker-containers">
			{#each data.containers as container (container.id)}
				<div class="docker-container">
					<span class="docker-container-dot" style="background: {statusColor(container.status)};"></span>
					<span class="docker-container-name" title={container.image}>{container.name}</span>
					<span class="docker-container-status" style="color: {statusColor(container.status)}">{statusLabel(container.status)}</span>
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
</style>
