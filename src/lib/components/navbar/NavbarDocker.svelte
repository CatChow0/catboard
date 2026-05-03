<script lang="ts">
	import type { DockerWidgetConfig } from '$lib/types';
	import { dockerData } from '$lib/stores/dashboard';

	let { colSpan = 2, config }: { colSpan?: number; config: DockerWidgetConfig } = $props();

	const data = $derived($dockerData[config?.environmentId || '']);
</script>

<div class="docker-widget">
	{#if data}
		<span class="docker-dot up"></span>
		<span class="docker-count">{data.runningCount}</span>
		<span class="docker-dot down"></span>
		<span class="docker-count">{data.stoppedCount}</span>
	{:else}
		<span class="docker-dot pending"></span>
		<span class="docker-loading">...</span>
	{/if}
</div>

<style>
	.docker-widget {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 8px;
		height: 100%;
		white-space: nowrap;
	}

	.docker-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.docker-dot.up {
		background: var(--success);
	}

	.docker-dot.down {
		background: var(--danger);
	}

	.docker-dot.pending {
		background: var(--text-muted);
		opacity: 0.5;
	}

	.docker-count {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.docker-loading {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
</style>