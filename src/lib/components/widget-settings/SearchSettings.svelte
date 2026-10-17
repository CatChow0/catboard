<script lang="ts">
	let { config = $bindable() }: { config: { placeholder?: string } } = $props();
</script>

<label class="field">
	<span>Placeholder text</span>
	<input type="text" bind:value={config.placeholder} placeholder="Search services..." />
</label>
<p class="hint">Searches every dashboard; Enter with no match searches the web.</p>
