<script lang="ts">
	// Edit a navbar widget: its catalog settings form (the same one the Add
	// popup shows), then icon / text size and width.
	import { t, locale } from '$lib/i18n';
	import { localWidget } from '$lib/i18n/catalog';
	import { untrack } from 'svelte';
	import { get } from 'svelte/store';
	import type { NavbarItem } from '$lib/types';
	import { updateNavbarItem, activeGrid } from '$lib/stores/dashboard';
	import { integrations, loadIntegrations } from '$lib/stores/integrations';
	import { widgetForType, draftFor, configFrom } from '$lib/widgets/catalog';

	let { item, onclose, onpreview }: {
		item: NavbarItem;
		onclose: () => void;
		/** Shows unsaved icon/text sizes on the widget while the modal is open. */
		onpreview?: (iconScale: number, textScale: number) => void;
	} = $props();

	const type = untrack(() => item.type);
	const def = widgetForType(type);
	const names: Partial<Record<NavbarItem['type'], string>> = { 'navbar-title': $t('widget.titleName'), 'navbar-adguard-home': 'AdGuard Home' };

	// The search box keeps its placeholder on the item, the others in config.
	const source = untrack(() => (item.type === 'navbar-search' ? { placeholder: item.placeholder } : 'config' in item ? item.config : undefined));
	let draft = $state(untrack(() => (def ? draftFor(def, source as Record<string, unknown>, 'navbar', get(integrations)) : {})));
	// Pickers (environments, printers...) follow the latest connections.
	loadIntegrations(true);
	const missing = $derived(def?.missing?.(draft) ?? null);

	// Sizes in percent. Title and Clock are text only; CPU/RAM/Disk scale their bars.
	let iconScale = $state(untrack(() => item.iconScale ?? 100));
	let textScale = $state(untrack(() => item.textScale ?? 100));
	let colSpan = $state(untrack(() => item.colSpan));
	const hasIcon = type !== 'navbar-title' && type !== 'navbar-clock';
	const iconLabel = ['navbar-cpu', 'navbar-ram', 'navbar-disk'].includes(type) ? $t('widget.barSize') : $t('widget.iconSize');

	$effect(() => {
		onpreview?.(iconScale, textScale);
	});

	let closing = $state(false);

	async function handleSave() {
		if (missing) return;
		const updates: Partial<NavbarItem> & { config?: Record<string, unknown>; placeholder?: string } = {
			colSpan: Math.min($activeGrid.navbar.columns, Math.max(1, Math.round(colSpan) || 1)),
			// 100% is the default; store nothing so the layout file stays clean.
			iconScale: hasIcon && iconScale !== 100 ? iconScale : undefined,
			textScale: textScale !== 100 ? textScale : undefined
		};
		if (def?.settings) {
			const cfg = configFrom(def, $state.snapshot(draft), 'navbar');
			if (item.type === 'navbar-search') updates.placeholder = cfg.placeholder;
			else updates.config = { ...('config' in item ? item.config : {}), ...cfg };
		}
		await updateNavbarItem(item.id, updates);
		close();
	}

	function close() {
		closing = true;
		setTimeout(() => onclose(), 180);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="modal-overlay" class:closing role="dialog" aria-modal="true" aria-label={$t('widget.editNavbar')} tabindex="-1" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}>
	<div class="modal" role="presentation" onclick={(e) => e.stopPropagation()}>
		<div class="modal-header">
			<h2>{$t('widget.editNavbarNamed', { name: (def && localWidget($locale, def).name) ?? names[type] ?? $t('widget.navbarFallback') })}</h2>
			<button class="btn-close" onclick={close} aria-label={$t('common.close')}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="modal-body cb-form">
			{#if def?.settings}
				<def.settings bind:config={draft} target="navbar" {...def.settingsProps} />
			{:else if type === 'navbar-title'}
				<p class="hint">{$t('widget.titleHint')}</p>
			{:else if type === 'navbar-ram'}
				<p class="hint">{$t('widget.ramHint')}</p>
			{/if}
			{#if missing}<p class="hint missing">{missing}</p>{/if}

			<p class="group-title">{$t('widget.size')}</p>
			{#if hasIcon}
				<div class="size-row">
					<label for="nb-icon-scale">{iconLabel}</label>
					<input id="nb-icon-scale" type="range" min="50" max="250" step="10" bind:value={iconScale} />
					<span class="size-value">{iconScale}%</span>
				</div>
			{/if}
			<div class="size-row">
				<label for="nb-text-scale">{$t('widget.textSize')}</label>
				<input id="nb-text-scale" type="range" min="50" max="250" step="10" bind:value={textScale} />
				<span class="size-value">{textScale}%</span>
			</div>
			{#if iconScale !== 100 || textScale !== 100}
				<button type="button" class="btn-reset" onclick={() => { iconScale = 100; textScale = 100; }}>{$t('widget.resetSize')}</button>
			{/if}

			<label class="field width">
				<span>{$t('widget.width')}</span>
				<input type="number" bind:value={colSpan} min="1" max={$activeGrid.navbar.columns} />
			</label>
		</div>

		<div class="modal-actions">
			<button class="btn-cancel" onclick={close}>{$t('common.cancel')}</button>
			<button class="btn-save" onclick={handleSave} disabled={!!missing}>{$t('common.save')}</button>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.15s ease;
	}

	.modal-overlay.closing {
		animation: fadeOut 0.18s ease forwards;
	}

	.modal {
		background: var(--bg-modal);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		max-width: 420px;
		width: 90%;
		animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.modal-header h2 {
		font-size: 1rem;
	}

	.btn-close {
		padding: 4px;
		border-radius: 4px;
		display: flex;
	}

	.btn-close:hover {
		background: var(--bg-card-hover);
	}

	.modal-body {
		padding: 16px 20px;
	}

	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
	}

	.btn-cancel {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		color: var(--text-secondary);
	}

	.btn-save {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: white;
		font-weight: 500;
	}

	.btn-save:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-body {
		max-height: 70vh;
		overflow-y: auto;
	}

	.missing {
		color: var(--warning, #f59e0b);
	}

	.width {
		margin-top: 12px;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes fadeOut {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.size-row {
		display: grid;
		grid-template-columns: 76px 1fr 44px;
		align-items: center;
		gap: 10px;
		margin-bottom: 6px;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.size-row input[type='range'] {
		width: 100%;
		accent-color: var(--accent);
	}

	.size-value {
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: var(--text-primary);
	}

	.btn-reset {
		font-size: 0.8rem;
		color: var(--accent);
		padding: 2px 0;
	}

</style>
