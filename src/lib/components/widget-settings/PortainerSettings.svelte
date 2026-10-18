<script lang="ts">
	import { onMount } from 'svelte';

	let { config = $bindable() }: { config: { endpointId: string } } = $props();

	let endpoints = $state<{ id: number; name: string }[] | null>(null);
	let error = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/api/integrations/portainer/overview');
			const body = await res.json();
			if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
			endpoints = body.endpoints;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<label class="field">
	<span>Environment</span>
	{#if endpoints}
		<select bind:value={config.endpointId}>
			<option value="">Every environment</option>
			{#each endpoints as e (e.id)}<option value={String(e.id)}>{e.name}</option>{/each}
		</select>
	{:else}
		<span class="hint">{error || 'Loading environments…'}</span>
	{/if}
</label>
<p class="hint">Refreshed every 30 seconds. Admins can start and stop stacks.</p>
