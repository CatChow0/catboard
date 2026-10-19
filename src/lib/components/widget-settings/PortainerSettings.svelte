<script lang="ts">
	import { t, errorText } from '$lib/i18n';
	import { onMount } from 'svelte';

	let { config = $bindable() }: { config: { endpointId: string } } = $props();

	let endpoints = $state<{ id: number; name: string }[] | null>(null);
	let error = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/api/integrations/portainer/overview');
			const body = await res.json();
			if (!res.ok) throw new Error(errorText(body, res.status));
			endpoints = body.endpoints;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<label class="field">
	<span>{$t('ws.environment')}</span>
	{#if endpoints}
		<select bind:value={config.endpointId}>
			<option value="">{$t('ws.everyEnvironment')}</option>
			{#each endpoints as e (e.id)}<option value={String(e.id)}>{e.name}</option>{/each}
		</select>
	{:else}
		<span class="hint">{error || $t('ws.loadingEnvironments')}</span>
	{/if}
</label>
<p class="hint">{$t('ws.refreshedEvery30SecondsAdminsCan')}</p>
