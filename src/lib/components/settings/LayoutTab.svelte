<script lang="ts">
	// Settings > Layout: title, service checks and breakpoints (per user), and
	// the grid / navbar of each dashboard x breakpoint (shared, editors only).
	// Edits the modal's LayoutDraft. Styles: settings.css.
	import { t } from '$lib/i18n';
	import { currentUser, dashboards, activeDashboardId, getBreakpointLabel, GRID_DEFAULTS } from '$lib/stores/dashboard';
	import type { LayoutDraft } from './layout-draft.svelte';

	let { draft }: { draft: LayoutDraft } = $props();
</script>

<div class="settings-section">
	<h3><label for="dash-title">{$t('layoutTab.title')}</label></h3>
	<input id="dash-title" type="text" bind:value={draft.title} />
</div>

<div class="settings-section">
	<h3>{$t('layoutTab.status')}</h3>
	<div class="field-row">
		<label for="status-interval">{$t('layoutTab.checkEvery')}</label>
		<select id="status-interval" bind:value={draft.statusCheckInterval}>
			<option value={10000}>{$t('layoutTab.s10')}</option>
			<option value={30000}>{$t('layoutTab.s30')}</option>
			<option value={60000}>{$t('layoutTab.m1')}</option>
			<option value={300000}>{$t('layoutTab.m5')}</option>
			<option value={600000}>{$t('layoutTab.m10')}</option>
		</select>
	</div>
</div>

<div class="settings-section">
	<h3>{$t('layoutTab.breakpoints')}</h3>
	<p class="section-hint">{$t('layoutTab.breakpointsHint')}</p>
	<div class="breakpoints-list">
		{#each draft.breakpoints as bp, i (bp.id)}
			<div class="breakpoint-row">
				<div class="field-row">
					<label for="bp-name-{bp.id}">{$t('layoutTab.name')}</label>
					<input id="bp-name-{bp.id}" type="text" bind:value={bp.name} placeholder={$t('layoutTab.namePlaceholder')} />
				</div>
				<div class="field-row">
					<label for="bp-min-{bp.id}">{$t('layoutTab.minWidth')}</label>
					<input id="bp-min-{bp.id}" type="number" bind:value={bp.minWidth} min="0" />
				</div>
				<div class="field-row">
					<label for="bp-cols-{bp.id}">{$t('layoutTab.columns')}</label>
					<input id="bp-cols-{bp.id}" type="number" bind:value={bp.columns} min="1" max="20" />
				</div>
				<button class="btn-remove" onclick={() => draft.removeBreakpoint(i)} disabled={draft.breakpoints.length <= 1} title={$t('common.remove')} aria-label={$t('layoutTab.removeBp')}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/each}
	</div>
	<button class="btn-add-bp" onclick={() => draft.addBreakpoint($t('layoutTab.newBp'))}>{$t('layoutTab.addBp')}</button>
</div>

{#if $currentUser?.canEdit}
	<div class="settings-section">
		<h3>{$t('layoutTab.dashLayout')}</h3>
		<p class="section-hint">{$t('layoutTab.dashLayoutHint')}</p>
		<div class="pair-picker">
			<label class="pair-dash">
				<span>{$t('layoutTab.dashboard')}</span>
				<select value={draft.selDash} onchange={(e) => draft.selectPair((e.currentTarget as HTMLSelectElement).value, draft.selBp)}>
					{#each $dashboards as d (d.id)}
						<option value={d.id}>{d.name}{d.id === $activeDashboardId ? ` ${$t('layoutTab.shown')}` : ''}</option>
					{/each}
				</select>
			</label>
			<div class="bp-tabs" role="tablist" aria-label={$t('layoutTab.breakpoint')}>
				{#each draft.breakpoints as bp (bp.id)}
					<button
						class="bp-tab"
						class:active={draft.selBp === bp.id}
						class:edited={draft.isEdited(draft.selDash, bp.id)}
						role="tab"
						aria-selected={draft.selBp === bp.id}
						onclick={() => draft.selectPair(draft.selDash, bp.id)}
					>
						{bp.name || getBreakpointLabel(draft.breakpoints, bp.id)}
					</button>
				{/each}
			</div>
		</div>

		<div class="pair-grid">
			<fieldset>
				<legend>{$t('layoutTab.grid')}</legend>
				<div class="field-row">
					<label for="lay-cell">{$t('layoutTab.cellHeight')}</label>
					<input id="lay-cell" type="number" min="40" max="300" placeholder={String(draft.defaultCellSize)} bind:value={draft.form.cellSize} oninput={() => draft.changed()} />
				</div>
				<div class="field-row">
					<label for="lay-gap">{$t('layoutTab.gap')}</label>
					<input id="lay-gap" type="number" min="0" max="48" placeholder={String(draft.defaultGap)} bind:value={draft.form.gap} oninput={() => draft.changed()} />
				</div>
			</fieldset>
			<fieldset>
				<legend>{$t('layoutTab.navbar')}</legend>
				<div class="field-row">
					<label for="lay-nbcols">{$t('layoutTab.columns')}</label>
					<input id="lay-nbcols" type="number" min="4" max="48" placeholder={String(GRID_DEFAULTS.navbarColumns)} bind:value={draft.form.navbarColumns} oninput={() => draft.changed()} />
				</div>
				<div class="field-row">
					<label for="lay-nbrow">{$t('layoutTab.rowHeight')}</label>
					<input id="lay-nbrow" type="number" min="28" max="120" placeholder={String(GRID_DEFAULTS.navbarRowHeight)} bind:value={draft.form.rowHeight} oninput={() => draft.changed()} />
				</div>
				<div class="field-row">
					<label for="lay-nbmt">{$t('layoutTab.marginTop')}</label>
					<input id="lay-nbmt" type="number" min="0" max="48" placeholder={String(GRID_DEFAULTS.navbarMarginTop)} bind:value={draft.form.marginTop} oninput={() => draft.changed()} />
				</div>
				<div class="field-row">
					<label for="lay-nbmb">{$t('layoutTab.marginBottom')}</label>
					<input id="lay-nbmb" type="number" min="0" max="48" placeholder={String(GRID_DEFAULTS.navbarMarginBottom)} bind:value={draft.form.marginBottom} oninput={() => draft.changed()} />
				</div>
			</fieldset>
		</div>

		<div class="pair-actions">
			<button class="btn-add-bp" onclick={() => draft.copyToAllBreakpoints()}>{draft.copiedNotice ? $t('layoutTab.copiedAll') : $t('layoutTab.copyAll')}</button>
			<button class="btn-add-bp" onclick={() => draft.resetPair()}>{$t('layoutTab.resetDefaults')}</button>
		</div>
		<p class="section-hint">
			{#if draft.isLivePair}{$t('layoutTab.live')}{:else}{$t('layoutTab.notLive')}{/if}
			{#if draft.pendingCount}<b>{$t('layoutTab.unsaved', { count: draft.pendingCount })}</b>{/if}
		</p>
	</div>
{/if}
