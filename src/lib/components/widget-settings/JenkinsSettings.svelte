<script lang="ts">
	import { onMount } from 'svelte';

	let { config = $bindable() }: { config: { mode: 'all' | 'job'; job: string; limit: number } } = $props();

	let jobs = $state<{ fullName: string }[] | null>(null);
	let error = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/api/integrations/jenkins/jobs');
			const body = await res.json();
			if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
			jobs = body.jobs;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<div class="field">
	<span>Show</span>
	<div class="seg">
		<button type="button" class:active={config.mode === 'all'} onclick={() => (config.mode = 'all')}>All projects</button>
		<button type="button" class:active={config.mode === 'job'} onclick={() => (config.mode = 'job')}>One project</button>
	</div>
</div>
{#if config.mode === 'job'}
	<label class="field">
		<span>Project</span>
		{#if jobs}
			<select bind:value={config.job}>
				<option value="">Select a project</option>
				{#each jobs as j (j.fullName)}<option value={j.fullName}>{j.fullName.split('/').join(' / ')}</option>{/each}
				{#if config.job && !jobs.some((j) => j.fullName === config.job)}<option value={config.job}>{config.job} (not found)</option>{/if}
			</select>
		{:else}
			<span class="hint">{error || 'Loading projects…'}</span>
		{/if}
		<span class="hint">Admins get a Run button to start a build (with a form when the project takes parameters).</span>
	</label>
{/if}
<label class="field">
	<span>Number of builds</span>
	<input type="number" min="1" max="50" bind:value={config.limit} />
</label>
