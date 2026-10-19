<script lang="ts">
	import { t } from '$lib/i18n';
	import type { CalendarConfig } from '$lib/types';
	import ArrSources from './ArrSources.svelte';

	let { config = $bindable() }: { config: CalendarConfig & { integrations: NonNullable<CalendarConfig['integrations']> } } = $props();
</script>

<ArrSources bind:sources={config.integrations} />
<p class="hint">{$t('ws.upcomingReleasesFromTheEnabledSources')}</p>
