<script lang="ts">
	import type { UptimeKumaStatusPageConfig } from '$lib/types';
	import { integrations } from '$lib/stores/integrations';

	let { config = $bindable() }: { config: UptimeKumaStatusPageConfig } = $props();
	const base = $derived(($integrations.uptimeKuma?.url || '').replace(/\/+$/, ''));
</script>

<label class="field">
	<span>Status page slug</span>
	<input type="text" bind:value={config.slug} placeholder="e.g. default" />
	<span class="hint">The end of the status page address{base ? `: ${base}/status/` : ': /status/'}<b>{config.slug || 'slug'}</b></span>
</label>
