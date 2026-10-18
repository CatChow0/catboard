<script lang="ts">
	let { config = $bindable() }: { config: { showQuota: boolean; showServer: boolean; files: number } } = $props();
</script>

<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showQuota} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Show my storage quota</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showServer} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Show server info <small>(Nextcloud admin and Monitoring app)</small></span>
</label>
<label class="field">
	<span>Recent files</span>
	<input type="number" min="0" max="20" bind:value={config.files} />
	<span class="hint">0 hides the list. Refreshed every 2 minutes.</span>
</label>
