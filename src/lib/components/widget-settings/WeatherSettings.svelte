<script lang="ts">
	import type { WeatherLocation } from '$lib/types';
	import LocationSearch from '../LocationSearch.svelte';

	let { config = $bindable() }: { config: { location: WeatherLocation | null } } = $props();
</script>

<div class="field">
	<span>Location</span>
	<LocationSearch bind:location={config.location} />
</div>
