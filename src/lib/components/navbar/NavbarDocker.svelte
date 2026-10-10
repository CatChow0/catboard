<script lang="ts">
	import type { DockerWidgetConfig } from '$lib/types';
	import { dockerData, isEditing } from '$lib/stores/dashboard';
	import DockerLogo from '../icons/DockerLogo.svelte';
	import DockerDetails from '../details/DockerDetails.svelte';
	import NavbarPopover from './NavbarPopover.svelte';

	let { config }: { colSpan?: number; config: DockerWidgetConfig } = $props();

	const data = $derived($dockerData[config?.environmentId || '']);
	const label = $derived(`Docker${data?.name ? `: ${data.name}` : ''}`);

	let button = $state<HTMLButtonElement>();
	let open = $state(false);

	// Edit mode drags navbar items; never leave a popover hanging there.
	$effect(() => {
		if ($isEditing) open = false;
	});

	function toggle() {
		if ($isEditing) return;
		open = !open;
	}
</script>

<div class="nb-wrap">
	<button bind:this={button} class="docker-widget" class:open class:editing={$isEditing} onclick={toggle} aria-expanded={open} aria-haspopup="dialog" title={label} aria-label="{label}, show containers">
		<span class="nb-logo"><DockerLogo size="calc(15px * var(--nb-icon, 1))" /></span>
		{#if data}
			<span class="docker-dot up"></span>
			<span class="docker-count">{data.runningCount}</span>
			<span class="docker-dot down"></span>
			<span class="docker-count">{data.stoppedCount}</span>
		{:else}
			<span class="docker-dot pending"></span>
			<span class="docker-loading">...</span>
		{/if}
	</button>

	{#if open && button}
		<NavbarPopover anchor={button} {label} onclose={() => (open = false)}>
			{#if data}
				<DockerDetails {data} />
			{:else}
				<p class="nb-empty">Loading…</p>
			{/if}
		</NavbarPopover>
	{/if}
</div>

<style>
	.nb-wrap {
		height: 100%;
		display: flex;
		align-items: center;
	}

	.docker-widget {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 8px;
		height: 100%;
		min-height: 34px;
		width: 100%;
		white-space: nowrap;
		background: none;
		border: 0;
		border-radius: var(--radius-sm);
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: background var(--transition);
	}

	.docker-widget:not(.editing):hover,
	.docker-widget.open {
		background: var(--bg-card-hover);
	}

	.docker-widget.editing {
		cursor: inherit;
	}

	.nb-logo {
		display: flex;
		flex-shrink: 0;
		margin-right: 2px;
		color: var(--text-secondary);
	}

	.docker-dot {
		width: calc(8px * var(--nb-icon, 1));
		height: calc(8px * var(--nb-icon, 1));
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
		font-size: calc(0.75rem * var(--nb-text, 1));
		font-weight: 600;
		color: var(--text-primary);
	}

	.docker-loading {
		font-size: calc(0.75rem * var(--nb-text, 1));
		color: var(--text-muted);
	}

	.nb-empty {
		margin: 0;
		padding: 12px;
		font-size: calc(0.8rem * var(--nb-text, 1));
		color: var(--text-muted);
	}
</style>
