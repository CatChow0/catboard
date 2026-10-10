<script lang="ts">
	import type { UptimeKumaStatusPageConfig } from '$lib/types';
	import { uptimeKumaData, isEditing } from '$lib/stores/dashboard';
	import UptimeKumaLogo from '../icons/UptimeKumaLogo.svelte';
	import UptimeKumaDetails from '../details/UptimeKumaDetails.svelte';
	import NavbarPopover from './NavbarPopover.svelte';

	let { config }: { colSpan?: number; config: UptimeKumaStatusPageConfig } = $props();

	const data = $derived($uptimeKumaData[config?.slug || '']);
	const label = $derived(`Uptime Kuma: ${data?.title || config?.slug || ''}`);

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

	function uptimeColor(pct: number): string {
		if (pct >= 99) return 'var(--success)';
		if (pct >= 95) return 'var(--warning)';
		return 'var(--danger)';
	}
</script>

<div class="nb-wrap">
	<button bind:this={button} class="uk-widget" class:open class:editing={$isEditing} onclick={toggle} aria-expanded={open} aria-haspopup="dialog" title={label} aria-label="{label}, show monitors">
		<span class="nb-logo"><UptimeKumaLogo size="calc(15px * var(--nb-icon, 1))" /></span>
		{#if data}
			<span class="uk-dot up"></span>
			<span class="uk-count">{data.activeCount}</span>
			<span class="uk-dot down"></span>
			<span class="uk-count">{data.inactiveCount}</span>
			<span class="uk-uptime" style="color: {uptimeColor(data.overallUptime)}">{data.overallUptime}%</span>
		{:else}
			<span class="uk-dot pending"></span>
			<span class="uk-loading">...</span>
		{/if}
	</button>

	{#if open && button}
		<NavbarPopover anchor={button} {label} onclose={() => (open = false)}>
			{#if data}
				<UptimeKumaDetails {data} />
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

	.uk-widget {
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

	.uk-widget:not(.editing):hover,
	.uk-widget.open {
		background: var(--bg-card-hover);
	}

	.uk-widget.editing {
		cursor: inherit;
	}

	.nb-logo {
		display: flex;
		flex-shrink: 0;
		margin-right: 2px;
		color: var(--text-secondary);
	}

	.uk-dot {
		width: calc(8px * var(--nb-icon, 1));
		height: calc(8px * var(--nb-icon, 1));
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
		font-size: calc(0.75rem * var(--nb-text, 1));
		font-weight: 600;
		color: var(--text-primary);
	}

	.uk-uptime {
		margin-left: 4px;
		font-size: calc(0.75rem * var(--nb-text, 1));
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.uk-loading {
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
