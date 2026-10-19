<script lang="ts">
	import { t } from '$lib/i18n';
	import type { StackerConfig, StackerSections } from '$lib/types';
	import { integrations } from '$lib/stores/integrations';

	let { config = $bindable() }: { config: StackerConfig & { sections: StackerSections } } = $props();
	const servers = $derived($integrations.stacker?.servers ?? []);
	const labels: [keyof StackerSections, string][] = [
		['cpu', 'CPU'],
		['memory', $t('ws.memory')],
		['gpu', 'GPU'],
		['disk', $t('ws.disk')],
		['network', $t('ws.network')]
	];
</script>

<label class="field">
	<span>{$t('ws.server')}</span>
	{#if servers.length}
		<select bind:value={config.serverId}>
			<option value="">{$t('ws.selectServer')}</option>
			{#each servers as srv (srv.id)}
				<option value={srv.id}>{srv.name || srv.url}</option>
			{/each}
		</select>
	{:else}
		<span class="hint">{$t('ws.noStackerServerYetAddOne')}</span>
	{/if}
</label>
<div class="field">
	<span>{$t('ws.sections')}</span>
	<div class="chips">
		{#each labels as [key, label] (key)}
			<label class="chip"><input type="checkbox" bind:checked={config.sections[key]} />{label}</label>
		{/each}
	</div>
</div>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.graphs} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.graphs')} <small>{$t('ws.hiddenAnywayOnSmallTiles')}</small></span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.totals} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.diskAndNetworkTotalsSinceBoot')}</span>
</label>
<p class="hint">{$t('ws.theWidgetAdaptsToItsSize')}</p>
