<script lang="ts">
	import type { QBittorrentConfig } from '$lib/types';

	let { config = $bindable() }: { config: QBittorrentConfig } = $props();
</script>

<label class="field">
	<span>Show</span>
	<select bind:value={config.filter}>
		<option value="active">Active torrents (with traffic)</option>
		<option value="downloading">Downloading</option>
		<option value="seeding">Seeding</option>
		<option value="all">All torrents (newest first)</option>
	</select>
</label>
<label class="field">
	<span>Number of torrents</span>
	<input type="number" min="1" max="50" bind:value={config.limit} />
</label>
<p class="hint">Only admins can pause or resume torrents.</p>
