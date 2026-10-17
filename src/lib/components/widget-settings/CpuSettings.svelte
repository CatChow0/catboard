<script lang="ts">
	import { onMount } from 'svelte';

	let { config = $bindable() }: { config: { tempSensor?: string } } = $props();

	let sensors = $state<string[] | null>(null);
	let loading = $state(false);

	async function detect() {
		loading = true;
		try {
			const res = await fetch('/api/temp-sensors');
			sensors = (await res.json()).sensors || [];
		} catch {
			sensors = [];
		} finally {
			loading = false;
		}
	}

	onMount(detect);
</script>

<div class="field">
	<span>Temperature sensor</span>
	{#if loading}
		<span class="hint">Detecting sensors…</span>
	{:else if sensors && sensors.length}
		<select bind:value={config.tempSensor}>
			<option value="">Auto (main)</option>
			{#each sensors as sensor (sensor)}
				<option value={sensor}>{sensor}</option>
			{/each}
		</select>
	{:else if sensors}
		<span class="hint">No temperature sensor found on this system.</span>
		<button type="button" class="btn-ghost" onclick={detect}>Detect again</button>
	{/if}
</div>
