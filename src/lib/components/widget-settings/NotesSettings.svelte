<script lang="ts">
	import { t } from '$lib/i18n';
	import type { NotesConfig } from '$lib/types';

	let { config = $bindable() }: { config: NotesConfig } = $props();
</script>

<label class="field">
	<span>{$t('ws.title')} <small>{$t('ws.optional')}</small></span>
	<input type="text" bind:value={config.title} placeholder="Notes" />
</label>
<p class="hint">{$t('ws.theNoteItselfIsWrittenOn')}</p>
