<script lang="ts">
	import type { StackerConfig, StackerSections } from '$lib/types';
	import { integrations } from '$lib/stores/integrations';

	let { config = $bindable() }: { config: StackerConfig & { sections: StackerSections } } = $props();
	const servers = $derived($integrations.stacker?.servers ?? []);
	const labels: [keyof StackerSections, string][] = [
		['cpu', 'CPU'],
		['memory', 'Memory'],
		['gpu', 'GPU'],
		['disk', 'Disk'],
		['network', 'Network']
	];
</script>

<label class="field">
	<span>Server</span>
	{#if servers.length}
		<select bind:value={config.serverId}>
			<option value="">Select server</option>
			{#each servers as srv (srv.id)}
				<option value={srv.id}>{srv.name || srv.url}</option>
			{/each}
		</select>
	{:else}
		<span class="hint">No Stacker server yet: add one in Settings &gt; Integrations &gt; Stacker.</span>
	{/if}
</label>
<div class="field">
	<span>Sections</span>
	<div class="chips">
		{#each labels as [key, label] (key)}
			<label class="chip"><input type="checkbox" bind:checked={config.sections[key]} />{label}</label>
		{/each}
	</div>
</div>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.graphs} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Graphs <small>(hidden anyway on small tiles)</small></span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.totals} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Disk and network totals since boot</span>
</label>
<p class="hint">The widget adapts to its size: one line per section on small tiles, tables and graphs on larger ones.</p>
