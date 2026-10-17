<script lang="ts">
	import type { DockerWidgetConfig } from '$lib/types';
	import { integrations } from '$lib/stores/integrations';

	let { config = $bindable(), target = 'grid' }: { config: DockerWidgetConfig; target?: 'grid' | 'navbar' } = $props();
	const environments = $derived($integrations.docker?.environments ?? []);
</script>

<label class="field">
	<span>Environment</span>
	{#if environments.length}
		<select bind:value={config.environmentId}>
			<option value="">Select environment</option>
			{#each environments as env (env.id)}
				<option value={env.id}>{env.name || env.url}</option>
			{/each}
		</select>
	{:else}
		<span class="hint">No Docker environment yet: add one in Settings &gt; Integrations &gt; Docker.</span>
	{/if}
</label>
<p class="group-title">Per-container usage</p>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showCpu} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Show CPU{#if target === 'navbar'} <small>(total in the bar, per container in the details)</small>{/if}</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showRam} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Show RAM{#if target === 'navbar'} <small>(total in the bar, per container in the details)</small>{/if}</span>
</label>
<p class="hint">Refreshed every 10 seconds. CPU is averaged between two readings (100% = one core).</p>
