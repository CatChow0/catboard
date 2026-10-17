<script lang="ts">
	import type { CalendarConfig } from '$lib/types';
	import ArrSources from './ArrSources.svelte';

	let { config = $bindable() }: { config: CalendarConfig & { integrations: NonNullable<CalendarConfig['integrations']> } } = $props();
</script>

<ArrSources bind:sources={config.integrations} />
<p class="hint">Upcoming releases from the enabled sources are marked on the calendar days.</p>
