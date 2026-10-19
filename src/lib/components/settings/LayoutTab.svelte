<script lang="ts">
	// Settings > Layout: title, service checks and breakpoints (per user), and
	// the grid / navbar of each dashboard x breakpoint (shared, editors only).
	// Edits the modal's LayoutDraft. Styles: settings.css.
	import { currentUser, dashboards, activeDashboardId, getBreakpointLabel, GRID_DEFAULTS } from '$lib/stores/dashboard';
	import type { LayoutDraft } from './layout-draft.svelte';

	let { draft }: { draft: LayoutDraft } = $props();
</script>

<div class="settings-section">
	<h3><label for="dash-title">Dashboard Title</label></h3>
	<input id="dash-title" type="text" bind:value={draft.title} />
</div>

<div class="settings-section">
	<h3>Service status</h3>
	<div class="field-row">
		<label for="status-interval">Check every</label>
		<select id="status-interval" bind:value={draft.statusCheckInterval}>
			<option value={10000}>10 seconds</option>
			<option value={30000}>30 seconds</option>
			<option value={60000}>1 minute</option>
			<option value={300000}>5 minutes</option>
			<option value={600000}>10 minutes</option>
		</select>
	</div>
</div>

<div class="settings-section">
	<h3>Breakpoints</h3>
	<p class="section-hint">Screen sizes shared by every dashboard: the widest breakpoint whose minimum width fits the window is used. Columns set the grid width.</p>
	<div class="breakpoints-list">
		{#each draft.breakpoints as bp, i (bp.id)}
			<div class="breakpoint-row">
				<div class="field-row">
					<label for="bp-name-{bp.id}">Name</label>
					<input id="bp-name-{bp.id}" type="text" bind:value={bp.name} placeholder="Layout name" />
				</div>
				<div class="field-row">
					<label for="bp-min-{bp.id}">Min Width</label>
					<input id="bp-min-{bp.id}" type="number" bind:value={bp.minWidth} min="0" />
				</div>
				<div class="field-row">
					<label for="bp-cols-{bp.id}">Columns</label>
					<input id="bp-cols-{bp.id}" type="number" bind:value={bp.columns} min="1" max="20" />
				</div>
				<button class="btn-remove" onclick={() => draft.removeBreakpoint(i)} disabled={draft.breakpoints.length <= 1} title="Remove" aria-label="Remove breakpoint">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/each}
	</div>
	<button class="btn-add-bp" onclick={() => draft.addBreakpoint()}>Add Breakpoint</button>
</div>

{#if $currentUser?.canEdit}
	<div class="settings-section">
		<h3>Dashboard Layout</h3>
		<p class="section-hint">Each dashboard has its own grid and navbar settings for every breakpoint. Empty fields use the default shown in grey.</p>
		<div class="pair-picker">
			<label class="pair-dash">
				<span>Dashboard</span>
				<select value={draft.selDash} onchange={(e) => draft.selectPair((e.currentTarget as HTMLSelectElement).value, draft.selBp)}>
					{#each $dashboards as d (d.id)}
						<option value={d.id}>{d.name}{d.id === $activeDashboardId ? ' (shown)' : ''}</option>
					{/each}
				</select>
			</label>
			<div class="bp-tabs" role="tablist" aria-label="Breakpoint">
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
				<legend>Grid</legend>
				<div class="field-row">
					<label for="lay-cell">Cell height (px)</label>
					<input id="lay-cell" type="number" min="40" max="300" placeholder={String(draft.defaultCellSize)} bind:value={draft.form.cellSize} oninput={() => draft.changed()} />
				</div>
				<div class="field-row">
					<label for="lay-gap">Gap (px)</label>
					<input id="lay-gap" type="number" min="0" max="48" placeholder={String(draft.defaultGap)} bind:value={draft.form.gap} oninput={() => draft.changed()} />
				</div>
			</fieldset>
			<fieldset>
				<legend>Navbar</legend>
				<div class="field-row">
					<label for="lay-nbcols">Columns</label>
					<input id="lay-nbcols" type="number" min="4" max="48" placeholder={String(GRID_DEFAULTS.navbarColumns)} bind:value={draft.form.navbarColumns} oninput={() => draft.changed()} />
				</div>
				<div class="field-row">
					<label for="lay-nbrow">Row height (px)</label>
					<input id="lay-nbrow" type="number" min="28" max="120" placeholder={String(GRID_DEFAULTS.navbarRowHeight)} bind:value={draft.form.rowHeight} oninput={() => draft.changed()} />
				</div>
				<div class="field-row">
					<label for="lay-nbmt">Top margin (px)</label>
					<input id="lay-nbmt" type="number" min="0" max="48" placeholder={String(GRID_DEFAULTS.navbarMarginTop)} bind:value={draft.form.marginTop} oninput={() => draft.changed()} />
				</div>
				<div class="field-row">
					<label for="lay-nbmb">Bottom margin (px)</label>
					<input id="lay-nbmb" type="number" min="0" max="48" placeholder={String(GRID_DEFAULTS.navbarMarginBottom)} bind:value={draft.form.marginBottom} oninput={() => draft.changed()} />
				</div>
			</fieldset>
		</div>

		<div class="pair-actions">
			<button class="btn-add-bp" onclick={() => draft.copyToAllBreakpoints()}>{draft.copiedNotice ? 'Copied to every breakpoint' : 'Copy to every breakpoint'}</button>
			<button class="btn-add-bp" onclick={() => draft.resetPair()}>Reset to defaults</button>
		</div>
		<p class="section-hint">
			{#if draft.isLivePair}Previewed live on the dashboard behind.{:else}This breakpoint is not the one on screen: changes apply after saving.{/if}
			{#if draft.pendingCount}<b>{draft.pendingCount} unsaved {draft.pendingCount > 1 ? 'layouts' : 'layout'}.</b>{/if}
		</p>
	</div>
{/if}
