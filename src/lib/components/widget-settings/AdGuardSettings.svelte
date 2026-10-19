<script lang="ts">
	import { t } from '$lib/i18n';
	import type { AdGuardHomeConfig } from '$lib/types';

	let { config = $bindable(), target = 'grid' }: { config: AdGuardHomeConfig; target?: 'grid' | 'navbar' } = $props();
	const aligns = [['left', $t('ws.left')], ['center', $t('ws.center')], ['right', $t('ws.right')]] as const;
</script>

{#if target === 'navbar'}
	<div class="field">
		<span>{$t('ws.alignmentInItsNavbarCell')}</span>
		<div class="seg">
			{#each aligns as [value, label] (value)}
				<button type="button" class:active={(config.align ?? 'center') === value} onclick={() => (config.align = value)}>{label}</button>
			{/each}
		</div>
	</div>
{:else}
	<p class="hint">{$t('ws.usesTheAdguardHomeConnectionFrom')}</p>
{/if}
