<script lang="ts">
	import type { DashboardItem as DashboardItemType, Service } from '$lib/stores/dashboard';
	import { resolveService, isEditing } from '$lib/stores/dashboard';
	import ServiceTile from './ServiceTile.svelte';
	import CollapsibleGroup from './CollapsibleGroup.svelte';
	import StandardGroup from './StandardGroup.svelte';
	import Calendar from './Calendar.svelte';
	import Clock from './Clock.svelte';
	import Weather from './Weather.svelte';
	import UptimeKumaStatusPage from './UptimeKumaStatusPage.svelte';
	import Docker from './Docker.svelte';
	import AdGuardStats from './AdGuardStats.svelte';
	import AdGuardControl from './AdGuardControl.svelte';
	import JellyfinLatest from './JellyfinLatest.svelte';

	let { item, allServices, effectiveColSpan, effectiveRowSpan, gridGap, onedit, onremove, ondragitem, draggingChildId, dragPlaceholder, selectedChildIds, ontogglechild }: {
		item: DashboardItemType;
		allServices: Service[];
		effectiveColSpan?: number;
		effectiveRowSpan?: number;
		gridGap?: number;
		onedit?: (service: Service) => void;
		onremove?: (itemId: string) => void;
		ondragitem?: (e: PointerEvent, child: DashboardItemType) => void;
		draggingChildId?: string | null;
		dragPlaceholder?: { col: number; row: number; colSpan: number; rowSpan: number } | null;
		selectedChildIds?: Set<string>;
		ontogglechild?: (groupId: string, childId: string, multiSelect: boolean) => void;
	} = $props();

	let service = $derived(
		item.type === 'service' ? resolveService(item.serviceId, allServices) : undefined
	);

	let colSpan = $derived(effectiveColSpan ?? item.colSpan);
	let rowSpan = $derived(effectiveRowSpan ?? item.rowSpan);
</script>

<div class="dashboard-item">
	{#if item.type === 'service' && service}
		<ServiceTile
			{service}
			{colSpan}
			{rowSpan}
			onedit={onedit ? () => onedit(service) : undefined}
			ondelete={onremove ? () => onremove(item.id) : undefined}
		/>
	{:else if item.type === 'group-collapsible'}
		<CollapsibleGroup item={item} {allServices} {onedit} {onremove} {ondragitem} {draggingChildId} {dragPlaceholder} selectedChildIds={selectedChildIds} ontogglechild={ontogglechild} {gridGap} />
	{:else if item.type === 'group-standard'}
		<StandardGroup item={item} {allServices} {onedit} {onremove} {ondragitem} {draggingChildId} {dragPlaceholder} selectedChildIds={selectedChildIds} ontogglechild={ontogglechild} {gridGap} />
	{:else if item.type === 'calendar'}
		<Calendar config={item.config} {colSpan} {rowSpan} ondelete={onremove ? () => onremove(item.id) : undefined} itemid={item.id} />
	{:else if item.type === 'clock'}
		<Clock config={item.config} {colSpan} {rowSpan} ondelete={onremove ? () => onremove(item.id) : undefined} itemid={item.id} />
	{:else if item.type === 'weather'}
		<Weather config={item.config} {colSpan} {rowSpan} ondelete={onremove ? () => onremove(item.id) : undefined} itemid={item.id} />
	{:else if item.type === 'docker'}
		<Docker config={item.config} {colSpan} {rowSpan} ondelete={onremove ? () => onremove(item.id) : undefined} itemid={item.id} />
	{:else if item.type === 'uptime-kuma-status-page'}
		<UptimeKumaStatusPage config={item.config} {colSpan} {rowSpan} ondelete={onremove ? () => onremove(item.id) : undefined} itemid={item.id} />
	{:else if item.type === 'adguard-home'}
		<AdGuardStats config={item.config} {colSpan} {rowSpan} ondelete={onremove ? () => onremove(item.id) : undefined} itemid={item.id} />
	{:else if item.type === 'adguard-home-control'}
		<AdGuardControl config={item.config} {colSpan} {rowSpan} ondelete={onremove ? () => onremove(item.id) : undefined} itemid={item.id} />
	{:else if item.type === 'jellyfin-latest'}
		<JellyfinLatest config={item.config} {colSpan} {rowSpan} ondelete={onremove ? () => onremove(item.id) : undefined} itemid={item.id} />
	{:else if item.type === 'service' && !service}
		<div class="missing-service">Service not found</div>
	{/if}
</div>

<style>
	.dashboard-item {
		min-width: 0;
		min-height: 0;
		height: 100%;
	}

	.missing-service {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		background: var(--bg-card);
		border: 1px dashed var(--danger);
		border-radius: var(--radius);
		color: var(--text-muted);
		font-size: 0.8rem;
		padding: 8px;
	}
</style>
