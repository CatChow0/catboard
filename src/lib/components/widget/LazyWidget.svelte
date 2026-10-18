<script lang="ts">
	// Renders a widget whose code loads on demand (see widgets/loaders.ts):
	// a skeleton while it downloads, a reload hint if the chunk is gone (the
	// app was updated since this page was opened).
	import { loadWidget, loadedWidget } from '$lib/widgets/loaders';
	import type { Component } from 'svelte';

	let { loader, props, inline = false }: {
		loader: () => Promise<{ default: Component<any> }>;
		props: Record<string, unknown>;
		/** Navbar slot: a small placeholder instead of a card. */
		inline?: boolean;
	} = $props();

	let Comp = $state<Component<any> | undefined>(undefined);
	let failed = $state(false);

	$effect(() => {
		const current = loader;
		const ready = loadedWidget(current);
		failed = false;
		if (ready) {
			Comp = ready;
			return;
		}
		Comp = undefined;
		loadWidget(current)
			.then((c) => current === loader && (Comp = c))
			.catch(() => current === loader && (failed = true));
	});
</script>

{#if Comp}
	<Comp {...props} />
{:else if failed}
	<button class="cb-widget-failed" class:inline onclick={() => location.reload()} title="CatBoard was updated: reload the page">
		{inline ? '↻' : 'Widget failed to load, click to reload'}
	</button>
{:else}
	<div class="cb-skeleton" class:inline aria-busy="true"></div>
{/if}

<style>
	.cb-widget-failed {
		width: 100%;
		height: 100%;
		background: var(--bg-card);
		border: 1px dashed var(--warning);
		border-radius: var(--radius);
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
	}

	.cb-widget-failed.inline {
		width: auto;
		padding: 0 10px;
		border-radius: var(--radius-sm);
	}
</style>
