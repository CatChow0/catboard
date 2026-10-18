<script lang="ts">
	let { config = $bindable() }: { config: { showStats: boolean; photos: number } } = $props();
</script>

<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showStats} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Show photo, video and storage counts</span>
</label>
<label class="field">
	<span>Latest photos</span>
	<input type="number" min="0" max="24" bind:value={config.photos} />
	<span class="hint">0 hides the photos. Refreshed every 5 minutes.</span>
</label>
