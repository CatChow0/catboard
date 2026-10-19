<script lang="ts">
	// Print status of an Elegoo Centauri Carbon 2: thumbnail, progress, times,
	// layers, temperatures and (admins only) pause / resume / stop. Shared by the
	// standard print widget and the navbar print popover.
	// `full` (standard widget) always shows the whole layout — preview area,
	// progress bar, print info, temperature cards and actions — with empty
	// values ("--") when nothing is printing, so an idle tile is not blank.
	import { t, errorText, locale } from '$lib/i18n';
	import { printLabel } from '$lib/i18n/catalog';
	import type { ElegooStatus, ElegooTemp } from '$lib/types';
	import { currentUser } from '$lib/stores/dashboard';
	import { duration, clockIn } from '$lib/utils/duration';
	import PrinterIcon from '../icons/PrinterIcon.svelte';

	let { status, printerId, showThumbnail = true, showTemps = true, dense = false, full = false, onchanged }: {
		status: ElegooStatus;
		printerId: string;
		showThumbnail?: boolean;
		showTemps?: boolean;
		/** Small tile: tighter spacing, smaller preview. */
		dense?: boolean;
		/** Always show every block, with placeholders when idle. */
		full?: boolean;
		/** Called after an action so the parent refreshes right away. */
		onchanged?: () => void;
	} = $props();

	const isAdmin = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');
	const active = $derived(['printing', 'preheating', 'pausing', 'paused', 'stopping'].includes(status.state));
	const hasJob = $derived(active || status.state === 'completed' || status.state === 'stopped');
	const canPause = $derived(status.state === 'printing' || status.state === 'preheating');
	const canResume = $derived(status.state === 'paused');
	const hasThumb = $derived(status.hasThumbnail && hasJob);
	// Compact (popover) mode only shows the preview when there is one; full mode keeps an empty frame.
	const showPreview = $derived(showThumbnail && (full || (!dense && hasThumb)));
	const showProgress = $derived(full || hasJob);
	const showActions = $derived(isAdmin && (full || active));

	let busy = $state(false);
	let actionError = $state('');

	async function act(action: 'pause' | 'resume' | 'stop') {
		if (action === 'stop' && !confirm($t('printer.confirmStop', { file: status.filename }))) return;
		busy = true;
		actionError = '';
		try {
			const res = await fetch('/api/integrations/elegoo/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ printer: printerId, action })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(errorText(body, res.status));
			onchanged?.();
		} catch (e) {
			actionError = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	const NONE = '--';
	const remaining = $derived(active && status.remainingSec > 0 ? duration(status.remainingSec) : NONE);
	const endsAt = $derived(active && status.remainingSec > 0 && status.state !== 'paused' ? clockIn(status.remainingSec) : '--:--');
	const elapsed = $derived(hasJob && status.elapsedSec > 0 ? duration(status.elapsedSec) : NONE);
	const layers = $derived(hasJob ? `${status.currentLayer || NONE} / ${status.totalLayers || NONE}` : `${NONE} / ${NONE}`);

	// Compact (popover) temperature line.
	const deg = (v: ElegooTemp | null) => (v ? `${Math.round(v.current)}${v.target > 0 ? ` / ${Math.round(v.target)}` : ''} °C` : '–');
	// Temperature cards: current value, and the target (or "off").
	const cur = (v: number | null | undefined) => (v == null ? NONE : String(Math.round(v)));
	const heating = (v: ElegooTemp | null) => !!v && v.target > 0 && Math.abs(v.current - v.target) > 2;
</script>

{#snippet tempCard(label: string, kind: 'nozzle' | 'bed' | 'chamber', value: number | null, target: number | null)}
	<div class="ep-tcard {kind}" class:on={target != null && target > 0} title={$t('printer.cardTitle', { label, value: cur(value) }) + (kind === 'chamber' ? '' : $t('printer.cardTarget', { target: target ? `${Math.round(target)} °C` : $t('printer.off') }))}>
		<span class="ep-ticon" aria-hidden="true">
			{#if kind === 'nozzle'}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10v5H7z" /><path d="M9 8h6v4l-3 3-3-3z" /><path d="M12 15v2" /><path d="M10 20.5c0-1 2-2.5 2-2.5s2 1.5 2 2.5a2 2 0 0 1-4 0z" /></svg>
			{:else if kind === 'bed'}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18v3H3z" /><path d="M7 13c-1-1.2 1-2.3 0-3.5M12 13c-1-1.2 1-2.3 0-3.5M17 13c-1-1.2 1-2.3 0-3.5" /></svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 7v6.5" /><circle cx="12" cy="15.5" r="2" /></svg>
			{/if}
		</span>
		<span class="ep-tlabel">{label}</span>
		<span class="ep-tvalue">{cur(value)}<small>°C</small></span>
		<span class="ep-ttarget">
			{#if kind === 'chamber'}
				{dense ? '' : $t('printer.ambient')}
			{:else if target != null && target > 0}
				→ {Math.round(target)}°
			{:else}
				→ {NONE}
			{/if}
		</span>
	</div>
{/snippet}

<div class="ep" class:dense class:full>
	{#if !status.online}
		<div class="ep-offline">
			<span class="ep-offline-icon"><PrinterIcon size={22} /></span>
			<div>
				<p class="ep-name">{status.name}</p>
				<p class="ep-error">{status.error}</p>
			</div>
		</div>
	{:else}
		<div class="ep-head">
			{#if showPreview}
				<div class="ep-preview" class:empty={!hasThumb}>
					{#if hasThumb}
						<img src="/api/integrations/elegoo/thumbnail?printer={encodeURIComponent(printerId)}&k={encodeURIComponent(status.thumbKey)}" alt={$t('printer.preview', { file: status.filename })} />
					{:else}
						<PrinterIcon size={dense ? 20 : 26} label={$t('printer.noPreview')} />
					{/if}
				</div>
			{/if}
			<div class="ep-title">
				<div class="ep-line">
					<span class="ep-name" title={status.model}>{status.name}</span>
					<span class="ep-badge {status.state}">{printLabel($locale, status.stateLabel)}</span>
				</div>
				{#if hasJob && status.filename}
					<span class="ep-file" title={status.filename}>{status.filename}</span>
				{:else if full}
					<span class="ep-file muted">{$t('printer.noPrint')}</span>
				{/if}
				{#if full}
					<span class="ep-speed">{$t('printer.speed')} <b>{active && status.speedMode ? printLabel($locale, status.speedMode) : NONE}</b></span>
				{/if}
			</div>
		</div>

		{#if showProgress}
			<div class="ep-progress">
				<span class="ep-pct" class:muted={!hasJob}>{hasJob ? Math.floor(status.progress) : NONE}<small>%</small></span>
				<div class="ep-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={hasJob ? Math.round(status.progress) : 0} aria-label={$t('printer.progress')}>
					<div class="ep-fill {status.state}" style:width="{hasJob ? status.progress : 0}%"></div>
				</div>
			</div>
			<dl class="ep-stats">
				{#if full || active}
					<div><dt>{$t('printer.remaining')}</dt><dd class:muted={remaining === NONE}>{remaining}</dd></div>
					<div><dt>{$t('printer.endsAt')}</dt><dd class:muted={endsAt === '--:--'}>{endsAt}</dd></div>
				{/if}
				<div><dt>{$t('printer.elapsed')}</dt><dd class:muted={elapsed === NONE}>{elapsed}</dd></div>
				<div><dt>{$t('printer.layer')}</dt><dd class:muted={!hasJob}>{layers}</dd></div>
			</dl>
		{/if}

		{#if showTemps}
			{#if full}
				<div class="ep-tcards">
					{@render tempCard($t('printer.nozzle'), 'nozzle', status.nozzle?.current ?? null, status.nozzle?.target ?? null)}
					{@render tempCard($t('printer.bed'), 'bed', status.bed?.current ?? null, status.bed?.target ?? null)}
					{@render tempCard($t('printer.chamber'), 'chamber', status.chamber, null)}
				</div>
			{:else}
				<div class="ep-temps">
					<span title={$t('printer.nozzleTitle')} class:hot={heating(status.nozzle)}>{$t('printer.nozzle')} <b>{deg(status.nozzle)}</b></span>
					<span title={$t('printer.bedTitle')} class:hot={heating(status.bed)}>{$t('printer.bed')} <b>{deg(status.bed)}</b></span>
					{#if status.chamber != null}<span title={$t('printer.chamber')}>{$t('printer.chamber')} <b>{Math.round(status.chamber)} °C</b></span>{/if}
					{#if status.speedMode && active}<span title={$t('printer.speedMode')}>{$t('printer.speed')} <b>{printLabel($locale, status.speedMode)}</b></span>{/if}
				</div>
			{/if}
		{/if}

		{#if showActions}
			<div class="ep-actions">
				{#if canResume}
					<button class="ep-btn" disabled={busy} onclick={() => act('resume')}>
						<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>{$t('printer.resume')}
					</button>
				{:else}
					<button class="ep-btn" disabled={busy || !canPause} onclick={() => act('pause')} title={canPause ? $t('printer.pauseTitle') : $t('printer.nothingPause')}>
						<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>{$t('printer.pause')}
					</button>
				{/if}
				<button class="ep-btn danger" disabled={busy || !active || status.state === 'stopping'} onclick={() => act('stop')} title={active ? $t('printer.stopTitle') : $t('printer.nothingStop')}>
					<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1.5" /></svg>{$t('printer.stop')}
				</button>
			</div>
		{/if}
		{#if actionError}<p class="ep-error">{actionError}</p>{/if}
	{/if}
</div>

<style>
	.ep {
		--ep-printing: var(--accent);
		--ep-heat: #f08c3c;
		--ep-panel: color-mix(in srgb, var(--bg-primary) 55%, transparent);
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		min-width: 0;
		font-variant-numeric: tabular-nums;
	}

	.ep.dense {
		gap: 7px;
		padding: 8px 10px;
	}

	.muted {
		color: var(--text-muted) !important;
	}

	/* --- Header --- */

	.ep-head {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.ep-preview {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		background: var(--ep-panel);
		border: 1px solid var(--border);
		overflow: hidden;
	}

	.full .ep-preview {
		width: 76px;
		height: 76px;
	}

	.dense .ep-preview {
		width: 48px;
		height: 48px;
	}

	.ep-preview.empty {
		color: color-mix(in srgb, var(--text-muted) 55%, transparent);
		border-style: dashed;
	}

	.ep-preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.ep-title {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
		flex: 1;
	}

	.ep-line {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.ep-name {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ep-file {
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ep-speed {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.ep-speed b {
		color: var(--text-secondary);
		font-weight: 600;
	}

	.ep-badge {
		flex-shrink: 0;
		margin-left: auto;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 0.68rem;
		font-weight: 600;
		white-space: nowrap;
		color: var(--text-secondary);
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
	}

	.ep-badge.printing {
		color: var(--ep-printing);
		background: color-mix(in srgb, var(--ep-printing) 18%, transparent);
	}

	.ep-badge.preheating {
		color: var(--ep-heat);
		background: color-mix(in srgb, var(--ep-heat) 18%, transparent);
	}

	.ep-badge.paused,
	.ep-badge.pausing {
		color: var(--warning);
		background: color-mix(in srgb, var(--warning) 18%, transparent);
	}

	.ep-badge.completed {
		color: var(--success);
		background: color-mix(in srgb, var(--success) 18%, transparent);
	}

	.ep-badge.stopped,
	.ep-badge.stopping,
	.ep-badge.error {
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 18%, transparent);
	}

	/* --- Progress --- */

	.ep-progress {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.ep-pct {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
		color: var(--text-primary);
		min-width: 3.2ch;
	}

	.dense .ep-pct {
		font-size: 1.15rem;
	}

	.ep-pct small {
		font-size: 0.6em;
		font-weight: 600;
		color: var(--text-muted);
		margin-left: 1px;
	}

	.ep-bar {
		flex: 1;
		height: 8px;
		border-radius: 4px;
		background: var(--border);
		overflow: hidden;
	}

	.ep-fill {
		height: 100%;
		border-radius: inherit;
		background: var(--ep-printing);
		transition: width 0.8s ease;
	}

	.ep-fill.preheating {
		background: var(--ep-heat);
	}

	.ep-fill.paused,
	.ep-fill.pausing {
		background: var(--warning);
	}

	.ep-fill.completed {
		background: var(--success);
	}

	.ep-fill.stopped,
	.ep-fill.stopping,
	.ep-fill.error {
		background: var(--danger);
	}

	/* --- Print info --- */

	.ep-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
		gap: 6px 10px;
		margin: 0;
	}

	.full .ep-stats {
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		background: var(--ep-panel);
		border: 1px solid var(--border);
	}

	.ep-stats div {
		min-width: 0;
	}

	.ep-stats dt {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}

	.ep-stats dd {
		margin: 1px 0 0;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* --- Temperatures --- */

	.ep-temps {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.ep-temps b {
		color: var(--text-primary);
		font-weight: 600;
	}

	.ep-temps .hot b {
		color: var(--ep-heat);
	}

	.ep-tcards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
		gap: 8px;
	}

	.ep-tcard {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-areas: 'icon label' 'icon value' 'icon target';
		column-gap: 8px;
		align-items: center;
		padding: 8px 10px;
		min-width: 0;
		border-radius: var(--radius-sm);
		background: var(--ep-panel);
		border: 1px solid var(--border);
	}

	.ep-ticon {
		grid-area: icon;
		display: flex;
		width: 26px;
		height: 26px;
		padding: 4px;
		border-radius: 8px;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 14%, transparent);
	}

	.ep-ticon svg {
		width: 100%;
		height: 100%;
	}

	.ep-tcard.on .ep-ticon {
		color: var(--ep-heat);
		background: color-mix(in srgb, var(--ep-heat) 16%, transparent);
	}

	.ep-tcard.chamber .ep-ticon {
		color: #3fb6ff;
		background: color-mix(in srgb, #3fb6ff 14%, transparent);
	}

	.ep-tlabel {
		grid-area: label;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}

	.ep-tvalue {
		grid-area: value;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.15;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.ep-tvalue small {
		font-size: 0.65em;
		font-weight: 600;
		color: var(--text-muted);
		margin-left: 1px;
	}

	.ep-ttarget {
		grid-area: target;
		font-size: 0.68rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ep-tcard.on .ep-ttarget {
		color: var(--text-secondary);
	}

	/* --- Actions --- */

	.ep-actions {
		display: flex;
		gap: 8px;
	}

	.ep-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
		background: color-mix(in srgb, var(--text-muted) 16%, transparent);
		transition: background var(--transition), color var(--transition);
	}

	.full .ep-btn {
		flex: 1;
		justify-content: center;
		padding: 7px 12px;
	}

	.ep-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent) 28%, transparent);
	}

	.ep-btn.danger:hover:not(:disabled) {
		color: white;
		background: var(--danger);
	}

	.ep-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	/* --- Full layout on smaller tiles (3 rows or less): same blocks, tighter --- */

	.full.dense .ep-preview {
		width: 52px;
		height: 52px;
	}

	.full.dense .ep-title {
		gap: 1px;
	}

	.full.dense .ep-stats {
		grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
		padding: 6px 8px;
		gap: 4px 8px;
	}

	.full.dense .ep-stats dd {
		font-size: 0.78rem;
	}

	.full.dense .ep-tcards {
		gap: 6px;
	}

	.full.dense .ep-tcard {
		grid-template-columns: auto auto 1fr;
		grid-template-areas: 'icon label label' 'icon value target';
		column-gap: 5px;
		padding: 5px 7px;
	}

	.full.dense .ep-ticon {
		width: 22px;
		height: 22px;
		padding: 3px;
	}

	.full.dense .ep-tvalue {
		font-size: 0.88rem;
	}

	.full.dense .ep-ttarget {
		font-size: 0.64rem;
		align-self: center;
	}

	.full.dense .ep-btn {
		padding: 5px 10px;
	}

	/* --- Offline --- */

	.ep-offline {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.ep-offline-icon {
		display: flex;
		color: var(--text-muted);
	}

	.ep-error {
		margin: 2px 0 0;
		font-size: 0.72rem;
		color: var(--danger);
	}
</style>
