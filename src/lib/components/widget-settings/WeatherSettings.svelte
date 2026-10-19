<script lang="ts">
	import { t } from '$lib/i18n';
	import type { WeatherLocation } from '$lib/types';
	import LocationSearch from '../LocationSearch.svelte';

	let { config = $bindable() }: { config: { location: WeatherLocation | null } } = $props();
</script>

<div class="field">
	<span>{$t('ws.location')}</span>
	<LocationSearch bind:location={config.location} />
</div>
