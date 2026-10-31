<script lang="ts">
	import { t, type Key } from '$lib/i18n';
	import type { ArrReleasesConfig, ReleaseLanguage } from '$lib/types';
	import ArrSources from './ArrSources.svelte';

	let { config = $bindable() }: {
		config: ArrReleasesConfig & {
			integrations: NonNullable<ArrReleasesConfig['integrations']>;
			languages: ReleaseLanguage[];
			languagePatterns: { vostfr?: string; vf?: string };
		};
	} = $props();

	const languageList: [ReleaseLanguage, Key][] = [['VO', 'ws.languageVo'], ['VOSTFR', 'ws.languageVostfr'], ['VF', 'ws.languageVf']];
</script>

<ArrSources bind:sources={config.integrations} bind:includeFeatures={config.includeFeatures} />
<label class="toggle-switch">
	<input type="checkbox" bind:checked={config.onlyDownloaded} />
	<span class="toggle-slider"></span>
	<span class="toggle-label">{$t('ws.downloadedOnly')}</span>
</label>
<div class="field-row">
	<label class="field">
		<span>{$t('ws.lastDays')}</span>
		<input type="number" min="1" max="90" bind:value={config.days} />
	</label>
	<label class="field">
		<span>{$t('ws.maxItems')}</span>
		<input type="number" min="1" max="50" bind:value={config.limit} />
	</label>
</div>
{#if config.integrations.sonarr}
	<p class="group-title">{$t('ws.languages')}</p>
	{#each languageList as [lang, label] (lang)}
		<label class="toggle-switch">
			<input type="checkbox" value={lang} bind:group={config.languages} />
			<span class="toggle-slider"></span>
			<span class="toggle-label">{$t(label)}</span>
		</label>
	{/each}
	<p class="hint">{$t('ws.languagesHint')}</p>
	{#if config.languages.length}
		<details class="patterns">
			<summary>{$t('ws.languagePatterns')}</summary>
			<label class="field">
				<span>VOSTFR</span>
				<input type="text" bind:value={config.languagePatterns.vostfr} placeholder={'\\bVOSTFR\\b'} spellcheck="false" />
			</label>
			<label class="field">
				<span>VF</span>
				<input type="text" bind:value={config.languagePatterns.vf} placeholder={'\\b(VF|VFF|VFQ|TRUEFRENCH|FRENCH|MULTI)\\b'} spellcheck="false" />
			</label>
			<p class="hint">{$t('ws.languagePatternsHint')}</p>
		</details>
	{/if}
{/if}

<style>
	.patterns {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.patterns summary {
		cursor: pointer;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-bottom: 6px;
	}
</style>
