<script lang="ts">
	import type { NotesConfig } from '$lib/types';

	let { config = $bindable() }: { config: NotesConfig } = $props();
</script>

<label class="field">
	<span>Title <small>(optional)</small></span>
	<input type="text" bind:value={config.title} placeholder="Notes" />
</label>
<p class="hint">The note itself is written on the tile (click it to edit), in Markdown.</p>
