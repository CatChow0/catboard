<script lang="ts">
	import { t } from '$lib/i18n';
	import type { DockerWidgetConfig } from '$lib/types';
	import { integrations } from '$lib/stores/integrations';

	let { config = $bindable(), target = 'grid' }: { config: DockerWidgetConfig; target?: 'grid' | 'navbar' } = $props();
	const environments = $derived($integrations.docker?.environments ?? []);
</script>

<label class="field">
	<span>{$t('ws.environment')}</span>
	{#if environments.length}
		<select bind:value={config.environmentId}>
			<option value="">{$t('ws.selectEnvironment')}</option>
			{#each environments as env (env.id)}
				<option value={env.id}>{env.name || env.url}</option>
			{/each}
		</select>
	{:else}
		<span class="hint">{$t('ws.noDockerEnvironmentYetAddOne')}</span>
	{/if}
</label>
<p class="group-title">{$t('ws.perContainerUsage')}</p>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showCpu} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showCpu')}{#if target === 'navbar'} <small>{$t('ws.totalInTheBarPerContainer')}</small>{/if}</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showRam} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showRam')}{#if target === 'navbar'} <small>{$t('ws.totalInTheBarPerContainer')}</small>{/if}</span>
</label>
<p class="hint">{$t('ws.refreshedEvery10SecondsCpuIs')}</p>
