<script lang="ts">
	// Edit modal of a dashboard widget: its catalog settings form (the same one
	// the Add popup shows) on a draft, saved with updateDashboardItem.
	import { untrack } from 'svelte';
	import { get } from 'svelte/store';
	import WidgetModal from './WidgetModal.svelte';
	import { updateDashboardItem } from '$lib/stores/dashboard';
	import { integrations, loadIntegrations } from '$lib/stores/integrations';
	import { widgetForType, draftFor, configFrom } from '$lib/widgets/catalog';

	let { type, itemid, config, onclose, onsaved }: {
		type: string;
		itemid: string;
		config?: object;
		onclose: () => void;
		onsaved?: () => void;
	} = $props();

	const def = untrack(() => widgetForType(type));
	let draft = $state(untrack(() => (def ? draftFor(def, config as Record<string, unknown>, 'grid', get(integrations)) : {})));
	// Pickers (environments, servers, printers) follow the latest connections.
	loadIntegrations(true);

	const missing = $derived(def?.missing?.(draft) ?? null);

	async function save() {
		if (!def) return;
		// Keys the form does not handle (a note's text...) are kept.
		const next = { ...(config ?? {}), ...configFrom(def, $state.snapshot(draft), 'grid') };
		onclose();
		await updateDashboardItem(itemid, { config: next } as never);
		onsaved?.();
	}
</script>

<WidgetModal title="Edit {def?.name ?? 'widget'}" {onclose} onsave={save} saveDisabled={!!missing}>
	{#if def?.settings}
		<def.settings bind:config={draft} target="grid" {...def.settingsProps} />
	{:else}
		<p class="hint">This widget has no settings.</p>
	{/if}
	{#if missing}<p class="hint missing">{missing}</p>{/if}
</WidgetModal>

<style>
	.missing {
		color: var(--warning, #f59e0b);
	}
</style>
