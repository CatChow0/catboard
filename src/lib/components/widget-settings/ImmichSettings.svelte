<script lang="ts">
	import { t } from '$lib/i18n';
	let { config = $bindable() }: { config: { showStats: boolean; photos: number } } = $props();
</script>

<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.showStats} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.showPhotoVideoAndStorageCounts')}</span>
</label>
<label class="field">
	<span>{$t('ws.latestPhotos')}</span>
	<input type="number" min="0" max="24" bind:value={config.photos} />
	<span class="hint">{$t('ws.0HidesThePhotosRefreshedEvery')}</span>
</label>
