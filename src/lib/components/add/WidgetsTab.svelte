<script lang="ts">
	// Add > Widgets: the catalog (search, categories); a card opens the widget's
	// settings form, then adds it to the dashboard or the navbar. Widgets that
	// need a connection link to Settings > Integrations. Styles: add.css.
	import { t, intlLocale, locale } from '$lib/i18n';
	import { categoryLabel, localIntegration, localWidget } from '$lib/i18n/catalog';
	import { addWidgetToDashboard, addNavbarItem, activeGrid, openSettings } from '$lib/stores/dashboard';
	import { integrations } from '$lib/stores/integrations';
	import { integrationDef } from '$lib/integrations/registry';
	import { WIDGETS, WIDGET_CATEGORIES, draftFor, configFrom, missingConnections, type WidgetCategory, type WidgetDef, type WidgetTarget } from '$lib/widgets/catalog';
	import Glyph from '$lib/widgets/Glyph.svelte';

	/** Closes the popup (after adding, or to open Settings). */
	let { close }: { close: () => void } = $props();

	let widgetQuery = $state('');
	let category = $state<WidgetCategory | 'all'>('all');
	let picked = $state<WidgetDef | null>(null);
	let target = $state<WidgetTarget>('grid');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let draft = $state<Record<string, any>>({});
	let colSpan = $state(2);
	let rowSpan = $state(1);

	const widgets = $derived(WIDGETS.map((w) => localWidget($locale, w)));
	const integName = (k: string) => {
		const d = integrationDef(k as never);
		return d ? localIntegration($locale, d).name : k;
	};
	const catalog = $derived.by(() => {
		const q = widgetQuery.trim().toLowerCase();
		return widgets.filter(
			(w) =>
				(category === 'all' || w.category === category) &&
				(!q || `${w.name} ${w.description} ${categoryLabel($locale, w.category)} ${(w.integrations ?? []).map(integName).join(' ')}`.toLowerCase().includes(q))
		);
	});
	const categories = $derived(WIDGET_CATEGORIES.filter((c) => widgets.some((w) => w.category === c)));

	const placeLabel = (w: WidgetDef) => (w.grid && w.navbar ? $t('add.both') : w.navbar ? $t('add.navbar') : '');
	const needsLabel = (missing: string[]) =>
		$t('add.needs', { list: missing.length > 1 ? new Intl.ListFormat(intlLocale() ?? 'en', { type: 'disjunction' }).format(missing.map(integName)) : missing[0] ? integName(missing[0]) : $t('add.aConnection') });

	function sizeFor(def: WidgetDef, t: WidgetTarget) {
		if (t === 'navbar') return { cols: def.navbar!.colSpan, rows: 1 };
		return { cols: Math.min(def.grid!.colSpan, $activeGrid.columns), rows: def.grid!.rowSpan };
	}

	function pick(def: WidgetDef) {
		picked = def;
		target = def.grid ? 'grid' : 'navbar';
		draft = draftFor(def, undefined, target, $integrations);
		({ cols: colSpan, rows: rowSpan } = sizeFor(def, target));
	}

	function setTarget(t: WidgetTarget) {
		if (!picked || t === target) return;
		target = t;
		({ cols: colSpan, rows: rowSpan } = sizeFor(picked, t));
	}

	function setUp(def: WidgetDef) {
		const key = def.integrations?.[0];
		close();
		setTimeout(() => openSettings('integrations', key), 200);
	}

	const maxCols = $derived(target === 'navbar' ? $activeGrid.navbar.columns : $activeGrid.columns);
	const minCols = $derived(target === 'grid' ? Math.min(picked?.grid?.minColSpan ?? 1, $activeGrid.columns) : 1);
	const missing = $derived(picked?.missing?.(draft) ?? null);

	async function addPicked() {
		const def = picked;
		if (!def || missing) return;
		const d = $state.snapshot(draft);
		const config = configFrom(def, d, target);
		const cols = Math.min(maxCols, Math.max(minCols, Math.round(colSpan) || 1));
		const rows = Math.min(12, Math.max(1, Math.round(rowSpan) || 1));
		const gridCols = $activeGrid.columns;
		close();
		if (target === 'navbar') {
			await addNavbarItem(def.navbar!.type, cols, config);
		} else if (def.group) {
			await addWidgetToDashboard(def.grid!.type, String(d.title ?? '').trim() || $t('add.newGroup'), cols, rows, gridCols, d.compact ? { compact: true } : undefined);
		} else {
			await addWidgetToDashboard(def.grid!.type, '', cols, rows, gridCols, config);
		}
	}
</script>

{#if picked}
	<div class="tab-content cb-form configure">
		<div class="cfg-head">
			<button class="btn-back" onclick={() => (picked = null)} aria-label={$t('add.backToWidgets')}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg>
			</button>
			<span class="cfg-icon"><Glyph name={picked.icon} size={24} /></span>
			<div>
				<h3>{picked.name}</h3>
				<p>{picked.description}</p>
			</div>
		</div>

		{#if picked.grid && picked.navbar}
			<div class="field">
				<span>{$t('add.placeIn')}</span>
				<div class="seg">
					<button type="button" class:active={target === 'grid'} onclick={() => setTarget('grid')}>{$t('add.dashboard')}</button>
					<button type="button" class:active={target === 'navbar'} onclick={() => setTarget('navbar')}>{$t('add.navbar')}</button>
				</div>
			</div>
		{/if}

		{#if picked.settings}
			<picked.settings bind:config={draft} {target} {...picked.settingsProps} />
		{/if}

		<p class="group-title">{$t('widget.size')}</p>
		<div class="field-row">
			<label class="field">
				<span>{$t('widget.width')}</span>
				<input type="number" bind:value={colSpan} min={minCols} max={maxCols} />
			</label>
			{#if target === 'grid'}
				<label class="field">
					<span>{$t('widget.height')}</span>
					<input type="number" bind:value={rowSpan} min="1" max="12" />
				</label>
			{/if}
		</div>
		<p class="hint">{$t('add.resizeHint')}</p>

		<div class="cfg-actions">
			{#if missing}<span class="missing">{missing}</span>{/if}
			<button class="btn-cancel" onclick={() => (picked = null)}>{$t('common.back')}</button>
			<button class="btn-save" onclick={addPicked} disabled={!!missing}>{target === 'navbar' ? $t('add.toNavbar') : $t('add.title')}</button>
		</div>
	</div>
{:else}
	<div class="tab-content">
		<div class="toolbar">
			<div class="search">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
				<input type="search" bind:value={widgetQuery} placeholder={$t('add.searchWidgets')} aria-label={$t('add.searchWidgets')} />
			</div>
		</div>
		<div class="chips-row" role="tablist" aria-label={$t('add.categories')}>
			<button class="cat" class:active={category === 'all'} role="tab" aria-selected={category === 'all'} onclick={() => (category = 'all')}>{$t('common.all')}</button>
			{#each categories as c (c)}
				<button class="cat" class:active={category === c} role="tab" aria-selected={category === c} onclick={() => (category = c)}>{categoryLabel($locale, c)}</button>
			{/each}
		</div>

		{#if catalog.length === 0}
			<p class="empty">{$t('add.noWidget', { query: widgetQuery })}</p>
		{:else}
			<div class="catalog">
				{#each catalog as w (w.id)}
					{@const miss = missingConnections(w, $integrations)}
					<div class="wcard" class:locked={miss.length > 0}>
						<button class="wcard-main" onclick={() => pick(w)} disabled={miss.length > 0}>
							<span class="wcard-icon"><Glyph name={w.icon} size={22} /></span>
							<span class="wcard-text">
								<span class="wcard-name">{w.name}</span>
								<span class="wcard-desc">{w.description}</span>
							</span>
							{#if placeLabel(w)}<span class="badge">{placeLabel(w)}</span>{/if}
						</button>
						{#if miss.length}
							<div class="wcard-setup">
								<span>{needsLabel(miss)}</span>
								<button onclick={() => setUp(w)}>{$t('add.setUp')}</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
