<script lang="ts">
	// Navbar print status: printer icon, mini progress bar, % and time left while
	// printing; click for the full details (actions included for admins).
	import type { ElegooPrintConfig } from '$lib/types';
	import { isEditing } from '$lib/stores/dashboard';
	import PrinterIcon from '../icons/PrinterIcon.svelte';
	import ElegooPrintDetails from '../details/ElegooPrintDetails.svelte';
	import NavbarPopover from './NavbarPopover.svelte';
	import { pollElegoo } from '../elegoo/pollElegoo.svelte';
	import { duration } from '$lib/utils/duration';

	let { config }: { colSpan?: number; config: ElegooPrintConfig } = $props();

	const poll = pollElegoo(() => config?.printerId || '', 5000);
	const status = $derived(poll.status);
	const printing = $derived(!!status && ['printing', 'preheating', 'pausing', 'paused', 'stopping'].includes(status.state));
	const label = $derived(status ? `${status.name}: ${status.online ? status.stateLabel : 'offline'}` : '3D printer');

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
	<button bind:this={button} class="print-widget" class:open class:editing={$isEditing} onclick={toggle} aria-expanded={open} aria-haspopup="dialog" title={label} aria-label="{label}, show print details">
		<span class="nb-logo"><PrinterIcon size="calc(15px * var(--nb-icon, 1))" /></span>
		{#if !config?.printerId}
			<span class="pw-muted">No printer</span>
		{:else if !status}
			<span class="pw-muted">…</span>
		{:else if !status.online}
			<span class="pw-dot off"></span><span class="pw-muted">Offline</span>
		{:else if printing}
			<span class="pw-bar"><span class="pw-fill {status.state}" style:width="{status.progress}%"></span></span>
			<span class="pw-pct">{Math.floor(status.progress)}%</span>
			{#if status.state === 'paused'}
				<span class="pw-muted">Paused</span>
			{:else if status.remainingSec > 0}
				<span class="pw-left">{duration(status.remainingSec)}</span>
			{/if}
		{:else}
			<span class="pw-dot {status.state}"></span><span class="pw-muted">{status.stateLabel}</span>
		{/if}
	</button>

	{#if open && button}
		<NavbarPopover anchor={button} {label} width={340} onclose={() => (open = false)}>
			{#if status}
				<ElegooPrintDetails {status} printerId={config.printerId} showThumbnail={config?.showThumbnail ?? true} showTemps={config?.showTemps ?? true} onchanged={poll.refresh} />
			{:else}
				<p class="nb-empty">{poll.error || 'Connecting to the printer…'}</p>
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

	.print-widget {
		display: flex;
		align-items: center;
		gap: 6px;
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
		overflow: hidden;
		font-variant-numeric: tabular-nums;
	}

	.print-widget:not(.editing):hover,
	.print-widget.open {
		background: var(--bg-card-hover);
	}

	.print-widget.editing {
		cursor: inherit;
	}

	.nb-logo {
		display: flex;
		flex-shrink: 0;
		color: var(--text-secondary);
	}

	.pw-bar {
		flex: 1;
		min-width: 30px;
		max-width: 120px;
		height: calc(6px * var(--nb-icon, 1));
		border-radius: 3px;
		background: var(--border);
		overflow: hidden;
	}

	.pw-fill {
		display: block;
		height: 100%;
		background: var(--accent);
		transition: width 0.8s ease;
	}

	.pw-fill.paused,
	.pw-fill.pausing {
		background: var(--warning);
	}

	.pw-fill.preheating {
		background: #f08c3c;
	}

	.pw-pct {
		font-size: calc(0.75rem * var(--nb-text, 1));
		font-weight: 700;
		color: var(--text-primary);
	}

	.pw-left,
	.pw-muted {
		font-size: calc(0.72rem * var(--nb-text, 1));
		color: var(--text-secondary);
	}

	.pw-muted {
		color: var(--text-muted);
	}

	.pw-dot {
		width: calc(8px * var(--nb-icon, 1));
		height: calc(8px * var(--nb-icon, 1));
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--text-muted);
	}

	.pw-dot.completed {
		background: var(--success);
	}

	.pw-dot.off,
	.pw-dot.error,
	.pw-dot.stopped {
		background: var(--danger);
	}

	.pw-dot.busy {
		background: var(--warning);
	}

	.nb-empty {
		margin: 0;
		padding: 12px;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
</style>
