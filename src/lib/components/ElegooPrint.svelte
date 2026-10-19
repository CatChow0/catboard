<script lang="ts">
	// Elegoo Centauri Carbon 2 print status. One row: a single line (name,
	// progress, time left); bigger tiles show the full details.
	import { t, locale } from '$lib/i18n';
	import { printLabel } from '$lib/i18n/catalog';
	import type { ElegooPrintConfig } from '$lib/types';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import ElegooPrintDetails from './details/ElegooPrintDetails.svelte';
	import PrinterIcon from './icons/PrinterIcon.svelte';
	import { pollElegoo } from './elegoo/pollElegoo.svelte';
	import { duration } from '$lib/utils/duration';

	let { config, colSpan = 3, rowSpan = 2, ondelete, itemid }: {
		config?: ElegooPrintConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const printerId = $derived(config?.printerId || '');
	const poll = pollElegoo(() => printerId);
	const status = $derived(poll.status);
	const line = $derived(rowSpan <= 1);
	const dense = $derived(colSpan <= 2 || rowSpan <= 3);
	const printing = $derived(!!status && ['printing', 'preheating', 'pausing', 'paused', 'stopping'].includes(status.state));

	let showEdit = $state(false);
</script>

<div class="pr-tile">
	<div class="pr-inner">
		{#if !printerId}
			<div class="pr-msg"><PrinterIcon size={22} /><span>{$t('printer.noneSelected')}</span></div>
		{:else if !status}
			<div class="pr-msg">{poll.error || $t('printer.connecting')}</div>
		{:else if line}
			<div class="pr-line" title={status.online ? `${status.name}: ${printLabel($locale, status.stateLabel)}` : status.error}>
				<span class="pr-icon"><PrinterIcon size={16} /></span>
				{#if !status.online}
					<span class="pr-text muted">{$t('printer.nameOffline', { name: status.name })}</span>
				{:else if printing}
					<span class="pr-text">{status.filename || printLabel($locale, status.stateLabel)}</span>
					<div class="pr-bar"><div class="pr-fill {status.state}" style:width="{status.progress}%"></div></div>
					<span class="pr-pct">{Math.floor(status.progress)}%</span>
					{#if status.remainingSec > 0}<span class="pr-left">{duration(status.remainingSec)}</span>{/if}
				{:else}
					<span class="pr-text">{status.name}</span>
					<span class="pr-state {status.state}">{printLabel($locale, status.stateLabel)}</span>
				{/if}
			</div>
		{:else}
			<ElegooPrintDetails {status} {printerId} {dense} full showThumbnail={config?.showThumbnail ?? true} showTemps={config?.showTemps ?? true} onchanged={poll.refresh} />
		{/if}
	</div>
	<EditButtons label={$t('widget.lblPrint')} {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="elegoo-print" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.pr-tile {
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.pr-inner {
		height: 100%;
		overflow: hidden auto;
		border-radius: inherit;
		display: flex;
		flex-direction: column;
		scrollbar-width: none;
	}

	/* Centred when it fits; when taller than the tile it starts at the top and
	   scrolls (justify-content: center would clip the top instead). */
	.pr-inner > :global(*) {
		margin-block: auto;
	}

	.pr-inner::-webkit-scrollbar {
		display: none;
	}

	.pr-msg {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 12px;
		font-size: 0.78rem;
		color: var(--text-muted);
		text-align: center;
	}

	.pr-line {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		min-width: 0;
		font-variant-numeric: tabular-nums;
	}

	.pr-icon {
		display: flex;
		color: var(--text-secondary);
		flex-shrink: 0;
	}

	.pr-text {
		min-width: 0;
		flex: 1;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pr-text.muted {
		color: var(--text-muted);
	}

	.pr-bar {
		flex: 1;
		min-width: 40px;
		height: 6px;
		border-radius: 3px;
		background: var(--border);
		overflow: hidden;
	}

	.pr-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.8s ease;
	}

	.pr-fill.paused,
	.pr-fill.pausing {
		background: var(--warning);
	}

	.pr-fill.preheating {
		background: #f08c3c;
	}

	.pr-pct {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.pr-left {
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.pr-state {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.pr-state.completed {
		color: var(--success);
	}

	.pr-state.error,
	.pr-state.stopped {
		color: var(--danger);
	}
</style>
