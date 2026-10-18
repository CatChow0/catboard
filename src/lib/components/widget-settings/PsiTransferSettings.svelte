<script lang="ts">
	import { onMount } from 'svelte';

	let { config = $bindable() }: { config: { retention: string; askOptions: boolean; history: number } } = $props();

	let retentions = $state<Record<string, string> | null>(null);
	let defaultRetention = $state('');
	let error = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/api/integrations/psitransfer/config');
			const body = await res.json();
			if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
			retentions = body.retentions;
			defaultRetention = body.defaultRetention;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<label class="field">
	<span>Keep files for (default)</span>
	{#if retentions}
		<select bind:value={config.retention}>
			<option value="">PsiTransfer default ({retentions[defaultRetention] ?? defaultRetention})</option>
			{#each Object.entries(retentions) as [key, label] (key)}<option value={key}>{label}</option>{/each}
		</select>
	{:else}
		<span class="hint">{error || 'Loading PsiTransfer settings…'}</span>
	{/if}
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.askOptions} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">Ask for retention and password before sending <small>(off: files are sent as soon as they are dropped)</small></span>
</label>
<label class="field">
	<span>Recent links shown (0 to 10, kept by this browser)</span>
	<input type="number" min="0" max="10" bind:value={config.history} />
</label>
