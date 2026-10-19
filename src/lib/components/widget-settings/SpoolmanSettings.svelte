<script lang="ts">
	import { t } from '$lib/i18n';
	import type { SpoolmanConfig, SpoolmanSection } from '$lib/types';

	type Draft = Required<Pick<SpoolmanConfig, 'title' | 'showRecent' | 'showLow' | 'showOnly' | 'sort' | 'order' | 'limit' | 'lowPercent' | 'lowGrams' | 'includeArchived'>>;
	let { config = $bindable() }: { config: Draft } = $props();

	const NAMES: Record<SpoolmanSection, string> = { list: $t('ws.spoolList'), recent: $t('ws.recentlyUsed'), low: $t('ws.runningLowEmpty') };
	const canShowOnly = $derived(config.showRecent || config.showLow);
	/** Whether a block would be shown with these settings. */
	const shown = (k: SpoolmanSection) => (k === 'list' ? !(canShowOnly && config.showOnly) : k === 'recent' ? config.showRecent : config.showLow);

	function move(i: number, dir: -1 | 1) {
		const next = [...config.order];
		[next[i], next[i + dir]] = [next[i + dir], next[i]];
		config.order = next;
	}
</script>

<label class="field">
	<span>{$t('ws.title')}</span>
	<input type="text" bind:value={config.title} placeholder="Spoolman" />
</label>
<label class="field">
	<span>{$t('ws.sortTheSpoolListBy')}</span>
	<select bind:value={config.sort}>
		<option value="name">{$t('ws.name')}</option>
		<option value="remaining">{$t('ws.remainingFilamentLeastFirst')}</option>
		<option value="lastUsed">{$t('ws.lastUsed')}</option>
	</select>
</label>
<p class="group-title">{$t('ws.extraSections')}</p>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showRecent} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.recentlyUsed')}</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showLow} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.runningLowEmpty')}</span>
</label>
<label class="toggle-switch" class:disabled={!canShowOnly} title={canShowOnly ? undefined : $t('ws.enableSectionFirst')}>
	<input type="checkbox" bind:checked={config.showOnly} disabled={!canShowOnly} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showOnlyTheseSections')} <small>{$t('ws.hideTheSpoolList')}</small></span>
</label>
<p class="group-title">{$t('ws.order')}</p>
<ol class="order">
	{#each config.order as key, i (key)}
		<li class:off={!shown(key)}>
			<span class="name">{NAMES[key]}</span>
			{#if !shown(key)}<span class="tag">{$t('ws.hidden')}</span>{/if}
			<button type="button" disabled={i === 0} onclick={() => move(i, -1)} aria-label={$t('ws.moveUp', { name: NAMES[key] })}>↑</button>
			<button type="button" disabled={i === config.order.length - 1} onclick={() => move(i, 1)} aria-label={$t('ws.moveDown', { name: NAMES[key] })}>↓</button>
		</li>
	{/each}
</ol>
<label class="field">
	<span>{$t('ws.spoolsPerSection')}</span>
	<input type="number" min="1" max="50" bind:value={config.limit} />
</label>
<div class="field-row">
	<label class="field">
		<span>{$t('ws.runningLowBelow')}</span>
		<input type="number" min="0" max="100" bind:value={config.lowPercent} />
	</label>
	<label class="field">
		<span>{$t('ws.orBelowG0Off')}</span>
		<input type="number" min="0" bind:value={config.lowGrams} />
	</label>
</div>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.includeArchived} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.includeArchivedSpools')} <small>{$t('ws.finishedSpoolsAreOftenArchived')}</small></span>
</label>

<style>
	.order {
		list-style: none;
		margin: 0 0 14px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.order li {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		font-size: 0.85rem;
	}

	.order li.off {
		opacity: 0.55;
	}

	.name {
		flex: 1;
	}

	.tag {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.order button {
		width: 26px;
		height: 24px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
	}

	.order button:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.order button:disabled {
		opacity: 0.35;
	}
</style>
