<script lang="ts">
	import { t, errorText } from '$lib/i18n';
	import { onMount } from 'svelte';

	let { config = $bindable() }: { config: { mode: 'all' | 'job'; job: string; limit: number } } = $props();

	let jobs = $state<{ fullName: string }[] | null>(null);
	let error = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/api/integrations/jenkins/jobs');
			const body = await res.json();
			if (!res.ok) throw new Error(errorText(body, res.status));
			jobs = body.jobs;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<div class="field">
	<span>{$t('ws.show')}</span>
	<div class="seg">
		<button type="button" class:active={config.mode === 'all'} onclick={() => (config.mode = 'all')}>{$t('ws.allProjects')}</button>
		<button type="button" class:active={config.mode === 'job'} onclick={() => (config.mode = 'job')}>{$t('ws.oneProject')}</button>
	</div>
</div>
{#if config.mode === 'job'}
	<label class="field">
		<span>{$t('ws.project')}</span>
		{#if jobs}
			<select bind:value={config.job}>
				<option value="">{$t('ws.selectAProject')}</option>
				{#each jobs as j (j.fullName)}<option value={j.fullName}>{j.fullName.split('/').join(' / ')}</option>{/each}
				{#if config.job && !jobs.some((j) => j.fullName === config.job)}<option value={config.job}>{$t('ws.notFound', { name: config.job })}</option>{/if}
			</select>
		{:else}
			<span class="hint">{error || $t('ws.loadingProjects')}</span>
		{/if}
		<span class="hint">{$t('ws.adminsGetARunButtonTo')}</span>
	</label>
{/if}
<label class="field">
	<span>{$t('ws.numberOfBuilds')}</span>
	<input type="number" min="1" max="50" bind:value={config.limit} />
</label>
