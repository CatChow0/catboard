<script lang="ts">
	import { t } from '$lib/i18n';
	let { config = $bindable() }: { config: { placeholder?: string } } = $props();
</script>

<label class="field">
	<span>{$t('ws.placeholderText')}</span>
	<input type="text" bind:value={config.placeholder} placeholder={$t('ws.searchServices')} />
</label>
<p class="hint">{$t('ws.searchesEveryDashboardEnterWithNo')}</p>
