<script lang="ts">
	import type { ArrReleasesConfig } from '$lib/types';
	import ArrSources from './ArrSources.svelte';

	let { config = $bindable() }: { config: ArrReleasesConfig & { integrations: NonNullable<ArrReleasesConfig['integrations']> } } = $props();
</script>

<ArrSources bind:sources={config.integrations} />
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.onlyDownloaded} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Downloaded only</span>
</label>
<div class="field-row">
	<label class="field">
		<span>Last days</span>
		<input type="number" min="1" max="90" bind:value={config.days} />
	</label>
	<label class="field">
		<span>Max items</span>
		<input type="number" min="1" max="50" bind:value={config.limit} />
	</label>
</div>
