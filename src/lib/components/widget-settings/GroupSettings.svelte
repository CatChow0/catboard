<script lang="ts">
	// Settings asked when adding a group (outline colour and scrolling are set
	// later, in the group's own edit panel).
	let { config = $bindable(), compactOption = false }: { config: { title?: string; compact?: boolean }; compactOption?: boolean } = $props();
</script>

<label class="field">
	<span>Title</span>
	<input type="text" bind:value={config.title} placeholder="Infrastructure" />
</label>
{#if compactOption}
	<label class="toggle-switch">
		<input type="checkbox" bind:checked={config.compact} />
		<span class="toggle-slider"></span>
		<span class="toggle-label">Compact mode <small>(no header)</small></span>
	</label>
{/if}
