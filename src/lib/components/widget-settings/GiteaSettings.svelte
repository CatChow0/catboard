<script lang="ts">
	import { t } from '$lib/i18n';
	let { config = $bindable() }: { config: { repos: number; issues: number } } = $props();
</script>

<div class="field-row">
	<label class="field">
		<span>{$t('gitea.reposShown')}</span>
		<input type="number" min="0" max="20" bind:value={config.repos} />
	</label>
	<label class="field">
		<span>{$t('gitea.issuesShown')}</span>
		<input type="number" min="0" max="20" bind:value={config.issues} />
	</label>
</div>
<p class="hint">{$t('gitea.settingsHint')}</p>
