<script lang="ts">
	import { onMount } from 'svelte';

	let { config = $bindable() }: { config: { disks: string[]; pageIndicatorSide?: 'left' | 'right' } } = $props();

	let disks = $state<string[] | null>(null);
	let loading = $state(false);

	async function detect() {
		loading = true;
		try {
			const res = await fetch('/api/disks');
			disks = (await res.json()).disks || [];
		} catch {
			disks = [];
		} finally {
			loading = false;
		}
	}

	onMount(detect);

	// Disks saved earlier but not detected now (unplugged, renamed) stay listed.
	const all = $derived([...new Set([...(disks ?? []), ...config.disks])]);

	function toggle(path: string) {
		config.disks = config.disks.includes(path) ? config.disks.filter((p) => p !== path) : [...config.disks, path];
	}
</script>

<div class="field">
	<span>Disks to monitor</span>
	{#if loading && !all.length}
		<span class="hint">Detecting disks…</span>
	{:else if all.length}
		<div class="chips">
			{#each all as path (path)}
				<label class="chip"><input type="checkbox" checked={config.disks.includes(path)} onchange={() => toggle(path)} />{path}</label>
			{/each}
		</div>
		<span class="hint">With several disks, the widget pages through them.</span>
	{:else}
		<span class="hint">No disk found.</span>
		<button type="button" class="btn-ghost" onclick={detect}>Detect again</button>
	{/if}
</div>
<div class="field">
	<span>Page indicator side</span>
	<div class="seg">
		<button type="button" class:active={config.pageIndicatorSide !== 'right'} onclick={() => (config.pageIndicatorSide = 'left')}>Left</button>
		<button type="button" class:active={config.pageIndicatorSide === 'right'} onclick={() => (config.pageIndicatorSide = 'right')}>Right</button>
	</div>
</div>
