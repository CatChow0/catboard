<script lang="ts">
	import { t } from '$lib/i18n';
	import type { JellyseerrRequestsConfig } from '$lib/types';

	let { config = $bindable() }: { config: JellyseerrRequestsConfig } = $props();
</script>

<div class="field">
	<span>{$t('ws.show')}</span>
	<div class="seg">
		<button type="button" class:active={config.filter !== 'all'} onclick={() => (config.filter = 'pending')}>{$t('ws.pendingOnly')}</button>
		<button type="button" class:active={config.filter === 'all'} onclick={() => (config.filter = 'all')}>{$t('ws.allRecent')}</button>
	</div>
</div>
<label class="field">
	<span>{$t('ws.numberOfRequests')}</span>
	<input type="number" min="1" max="30" bind:value={config.limit} />
</label>
<p class="hint">{$t('ws.onlyAdminsCanApproveOrDecline')}</p>
