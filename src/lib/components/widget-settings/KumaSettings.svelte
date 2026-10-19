<script lang="ts">
	import { t } from '$lib/i18n';
	import type { UptimeKumaStatusPageConfig } from '$lib/types';
	import { integrations } from '$lib/stores/integrations';

	let { config = $bindable() }: { config: UptimeKumaStatusPageConfig } = $props();
	const base = $derived(($integrations.uptimeKuma?.url || '').replace(/\/+$/, ''));
</script>

<label class="field">
	<span>{$t('ws.statusPageSlug')}</span>
	<input type="text" bind:value={config.slug} placeholder={$t('ws.eGDefault')} />
	<span class="hint">{$t('ws.slugHint')}{base ? `: ${base}/status/` : ': /status/'}<b>{config.slug || 'slug'}</b></span>
</label>
