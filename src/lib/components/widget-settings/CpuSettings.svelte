<script lang="ts">
	import { t } from '$lib/i18n';
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
	<span>{$t('ws.temperatureSensor')}</span>
	{#if loading}
		<span class="hint">{$t('ws.detectingSensors')}</span>
	{:else if sensors && sensors.length}
		<select bind:value={config.tempSensor}>
			<option value="">{$t('ws.autoMain')}</option>
			{#each sensors as sensor (sensor)}
				<option value={sensor}>{sensor}</option>
			{/each}
		</select>
	{:else if sensors}
		<span class="hint">{$t('ws.noTemperatureSensorFoundOnThis')}</span>
		<button type="button" class="btn-ghost" onclick={detect}>{$t('ws.detectAgain')}</button>
	{/if}
</div>
