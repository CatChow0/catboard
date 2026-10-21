<script lang="ts">
	// Radarr / Sonarr / Lidarr / Deezer switches; a source without a connection is
	// greyed out. Deezer adds a switch for the releases artists only appear on.
	import { t } from '$lib/i18n';
	import { integrations } from '$lib/stores/integrations';

	type Sources = { radarr?: boolean; sonarr?: boolean; lidarr?: boolean; deezer?: boolean };
	let { sources = $bindable(), includeFeatures = $bindable(false) }: { sources: Sources; includeFeatures?: boolean } = $props();
	const list = [['radarr', 'Radarr'], ['sonarr', 'Sonarr'], ['lidarr', 'Lidarr'], ['deezer', 'Deezer to Navidrome']] as const;
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
{#if sources.deezer && $integrations.deezer?.url}
	<label class="toggle-switch indented">
		<input type="checkbox" bind:checked={includeFeatures} />
		<span class="toggle-slider"></span>
		<span class="toggle-label">{$t('ws.includeFeatures')} <small>{$t('ws.includeFeaturesHint')}</small></span>
	</label>
{/if}
