<script lang="ts">
	import type { ElegooPrintConfig } from '$lib/types';
	import { integrations } from '$lib/stores/integrations';

	let { config = $bindable(), target = 'grid' }: { config: ElegooPrintConfig; target?: 'grid' | 'navbar' } = $props();
	const printers = $derived($integrations.elegoo?.printers ?? []);
</script>

<label class="field">
	<span>Printer</span>
	{#if printers.length}
		<select bind:value={config.printerId}>
			<option value="">Select printer</option>
			{#each printers as p (p.id)}
				<option value={p.id}>{p.name || p.host}</option>
			{/each}
		</select>
	{:else}
		<span class="hint">No printer yet: add one in Settings &gt; Integrations &gt; Elegoo printers.</span>
	{/if}
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showThumbnail} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Show the model preview{target === 'navbar' ? ' in the details' : ''}</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showTemps} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Show temperatures and speed{target === 'navbar' ? ' in the details' : ''}</span>
</label>
