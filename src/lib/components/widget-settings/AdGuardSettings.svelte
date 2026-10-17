<script lang="ts">
	import type { AdGuardHomeConfig } from '$lib/types';

	let { config = $bindable(), target = 'grid' }: { config: AdGuardHomeConfig; target?: 'grid' | 'navbar' } = $props();
	const aligns = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] as const;
</script>

{#if target === 'navbar'}
	<div class="field">
		<span>Alignment in its navbar cell</span>
		<div class="seg">
			{#each aligns as [value, label] (value)}
				<button type="button" class:active={(config.align ?? 'center') === value} onclick={() => (config.align = value)}>{label}</button>
			{/each}
		</div>
	</div>
{:else}
	<p class="hint">Uses the AdGuard Home connection from Settings &gt; Integrations. Pausing protection needs an admin.</p>
{/if}
