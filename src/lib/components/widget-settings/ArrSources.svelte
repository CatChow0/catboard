<script lang="ts">
	// Radarr / Sonarr / Lidarr switches; a source without a connection is greyed out.
	import { t } from '$lib/i18n';
	import { integrations } from '$lib/stores/integrations';

	type Sources = { radarr?: boolean; sonarr?: boolean; lidarr?: boolean };
	let { sources = $bindable() }: { sources: Sources } = $props();
	const list = [['radarr', 'Radarr'], ['sonarr', 'Sonarr'], ['lidarr', 'Lidarr']] as const;
</script>

<p class="group-title">{$t('ws.sources')}</p>
{#each list as [key, label] (key)}
	{@const ok = !!$integrations[key]?.url}
	<label class="toggle-switch" class:disabled={!ok}>
		<input type="checkbox" bind:checked={sources[key]} disabled={!ok} />
		<span class="toggle-slider"></span>
		<span class="toggle-label">{label}{#if !ok} <small>{$t('ws.notConfigured')}</small>{/if}</span>
	</label>
{/each}
