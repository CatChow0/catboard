<script lang="ts">
	import { t, errorText } from '$lib/i18n';
	import { onMount } from 'svelte';

	let { config = $bindable() }: { config: { retention: string; askOptions: boolean; history: number } } = $props();

	let retentions = $state<Record<string, string> | null>(null);
	let defaultRetention = $state('');
	let error = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/api/integrations/psitransfer/config');
			const body = await res.json();
			if (!res.ok) throw new Error(errorText(body, res.status));
			retentions = body.retentions;
			defaultRetention = body.defaultRetention;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<label class="field">
	<span>{$t('ws.keepFilesForDefault')}</span>
	{#if retentions}
		<select bind:value={config.retention}>
			<option value="">{$t('ws.psiDefault', { value: retentions[defaultRetention] ?? defaultRetention })}</option>
			{#each Object.entries(retentions) as [key, label] (key)}<option value={key}>{label}</option>{/each}
		</select>
	{:else}
		<span class="hint">{error || $t('ws.loadingPsi')}</span>
	{/if}
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.askOptions} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.askForRetentionAndPasswordBefore')} <small>{$t('ws.offFilesAreSentAsSoon')}</small></span>
</label>
<label class="field">
	<span>{$t('ws.recentLinksShown0To10')}</span>
	<input type="number" min="0" max="10" bind:value={config.history} />
</label>
