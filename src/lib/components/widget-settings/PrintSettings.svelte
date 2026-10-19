<script lang="ts">
	import { t } from '$lib/i18n';
	import type { ElegooPrintConfig } from '$lib/types';
	import { integrations } from '$lib/stores/integrations';

	let { config = $bindable(), target = 'grid' }: { config: ElegooPrintConfig; target?: 'grid' | 'navbar' } = $props();
	const printers = $derived($integrations.elegoo?.printers ?? []);
</script>

<label class="field">
	<span>{$t('ws.printer')}</span>
	{#if printers.length}
		<select bind:value={config.printerId}>
			<option value="">{$t('ws.selectPrinter')}</option>
			{#each printers as p (p.id)}
				<option value={p.id}>{p.name || p.host}</option>
			{/each}
		</select>
	{:else}
		<span class="hint">{$t('ws.noPrinterYetAddOneIn')}</span>
	{/if}
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showThumbnail} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showTheModelPreview')}{target === 'navbar' ? $t('ws.inDetails') : ''}</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showTemps} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showTemperaturesAndSpeed')}{target === 'navbar' ? $t('ws.inDetails') : ''}</span>
</label>
