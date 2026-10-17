<script lang="ts">
	import type { SpoolmanConfig, SpoolmanSection } from '$lib/types';

	type Draft = Required<Pick<SpoolmanConfig, 'title' | 'showRecent' | 'showLow' | 'showOnly' | 'sort' | 'order' | 'limit' | 'lowPercent' | 'lowGrams' | 'includeArchived'>>;
	let { config = $bindable() }: { config: Draft } = $props();

	const NAMES: Record<SpoolmanSection, string> = { list: 'Spool list', recent: 'Recently used', low: 'Running low / empty' };
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
	<span>Title</span>
	<input type="text" bind:value={config.title} placeholder="Spoolman" />
</label>
<label class="field">
	<span>Sort the spool list by</span>
	<select bind:value={config.sort}>
		<option value="name">Name</option>
		<option value="remaining">Remaining filament (least first)</option>
		<option value="lastUsed">Last used</option>
	</select>
</label>
<p class="group-title">Extra sections</p>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showRecent} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Recently used</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showLow} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Running low / empty</span>
</label>
<label class="toggle-switch" class:disabled={!canShowOnly} title={canShowOnly ? undefined : 'Enable a section first'}>
	<input type="checkbox" bind:checked={config.showOnly} disabled={!canShowOnly} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Show only these sections <small>(hide the spool list)</small></span>
</label>
<p class="group-title">Order</p>
<ol class="order">
	{#each config.order as key, i (key)}
		<li class:off={!shown(key)}>
			<span class="name">{NAMES[key]}</span>
			{#if !shown(key)}<span class="tag">hidden</span>{/if}
			<button type="button" disabled={i === 0} onclick={() => move(i, -1)} aria-label="Move {NAMES[key]} up">↑</button>
			<button type="button" disabled={i === config.order.length - 1} onclick={() => move(i, 1)} aria-label="Move {NAMES[key]} down">↓</button>
		</li>
	{/each}
</ol>
<label class="field">
	<span>Spools per section</span>
	<input type="number" min="1" max="50" bind:value={config.limit} />
</label>
<div class="field-row">
	<label class="field">
		<span>Running low below (%)</span>
		<input type="number" min="0" max="100" bind:value={config.lowPercent} />
	</label>
	<label class="field">
		<span>…or below (g, 0 = off)</span>
		<input type="number" min="0" bind:value={config.lowGrams} />
	</label>
</div>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.includeArchived} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Include archived spools <small>(finished spools are often archived)</small></span>
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
