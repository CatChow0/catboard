<script lang="ts">
	import type { JellyseerrRequestsConfig } from '$lib/types';

	let { config = $bindable() }: { config: JellyseerrRequestsConfig } = $props();
</script>

<div class="field">
	<span>Show</span>
	<div class="seg">
		<button type="button" class:active={config.filter !== 'all'} onclick={() => (config.filter = 'pending')}>Pending only</button>
		<button type="button" class:active={config.filter === 'all'} onclick={() => (config.filter = 'all')}>All recent</button>
	</div>
</div>
<label class="field">
	<span>Number of requests</span>
	<input type="number" min="1" max="30" bind:value={config.limit} />
</label>
<p class="hint">Only admins can approve or decline requests.</p>
