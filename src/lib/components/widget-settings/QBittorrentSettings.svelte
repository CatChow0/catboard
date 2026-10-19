<script lang="ts">
	import { t } from '$lib/i18n';
	import type { QBittorrentConfig } from '$lib/types';

	let { config = $bindable() }: { config: QBittorrentConfig } = $props();
</script>

<label class="field">
	<span>{$t('ws.show')}</span>
	<select bind:value={config.filter}>
		<option value="active">{$t('ws.activeTorrentsWithTraffic')}</option>
		<option value="downloading">{$t('ws.downloading')}</option>
		<option value="seeding">{$t('ws.seeding')}</option>
		<option value="all">{$t('ws.allTorrentsNewestFirst')}</option>
	</select>
</label>
<label class="field">
	<span>{$t('ws.numberOfTorrents')}</span>
	<input type="number" min="1" max="50" bind:value={config.limit} />
</label>
<p class="hint">{$t('ws.onlyAdminsCanPauseOrResume')}</p>
