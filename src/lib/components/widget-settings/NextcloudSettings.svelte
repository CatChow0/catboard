<script lang="ts">
	import { t } from '$lib/i18n';
	let { config = $bindable() }: { config: { showQuota: boolean; showServer: boolean; files: number } } = $props();
</script>

<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showQuota} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showMyStorageQuota')}</span>
</label>
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showServer} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showServerInfo')} <small>{$t('ws.nextcloudAdminAndMonitoringApp')}</small></span>
</label>
<label class="field">
	<span>{$t('ws.recentFiles')}</span>
	<input type="number" min="0" max="20" bind:value={config.files} />
	<span class="hint">{$t('ws.0HidesTheListRefreshedEvery')}</span>
</label>
