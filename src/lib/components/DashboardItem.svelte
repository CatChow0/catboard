<script lang="ts">
	import { t } from '$lib/i18n';
	import type { DashboardItem as DashboardItemType, Service } from '$lib/stores/dashboard';
	import { resolveService } from '$lib/stores/dashboard';
	import type { GroupDragView } from '$lib/utils/grid';
	import ServiceTile from './ServiceTile.svelte';
	import CollapsibleGroup from './CollapsibleGroup.svelte';
	import StandardGroup from './StandardGroup.svelte';
	import LazyWidget from './widget/LazyWidget.svelte';
	import { GRID_WIDGETS } from '$lib/widgets/loaders';

	let { item, allServices, effectiveColSpan, effectiveRowSpan, gridGap, onedit, onremove, ondragitem, dragView, selectedChildIds, ontogglechild, query, matchingIds }: {
		item: DashboardItemType;
		allServices: Service[];
		effectiveColSpan?: number;
		effectiveRowSpan?: number;
		gridGap?: number;
		onedit?: (service: Service) => void;
		onremove?: (itemId: string) => void;
		ondragitem?: (e: PointerEvent, child: DashboardItemType) => void;
		dragView?: GroupDragView | null;
		selectedChildIds?: Set<string>;
		ontogglechild?: (groupId: string, childId: string, multiSelect: boolean) => void;
		query?: string;
		matchingIds?: Set<string>;
	} = $props();

	let service = $derived(
		item.type === 'service' ? resolveService(item.serviceId, allServices) : undefined
	);

	let colSpan = $derived(effectiveColSpan ?? item.colSpan);
	let rowSpan = $derived(effectiveRowSpan ?? item.rowSpan);

	// Every widget takes the same props; its code is loaded on demand.
	let loader = $derived(GRID_WIDGETS[item.type]);
	let widgetProps = $derived({
		config: 'config' in item ? item.config : undefined,
		colSpan,
		rowSpan,
		ondelete: onremove ? () => onremove(item.id) : undefined,
		itemid: item.id
	});
</script>

<div class="dashboard-item cb-item-{item.type}">
	{#if item.type === 'service' && service}
		<ServiceTile
			{service}
			{colSpan}
			{rowSpan}
			onedit={onedit ? () => onedit(service) : undefined}
			ondelete={onremove ? () => onremove(item.id) : undefined}
		/>
	{:else if item.type === 'group-collapsible'}
		<CollapsibleGroup item={item} {allServices} {onedit} {onremove} {ondragitem} {dragView} selectedChildIds={selectedChildIds} ontogglechild={ontogglechild} {gridGap} {query} {matchingIds} />
	{:else if item.type === 'group-standard'}
		<StandardGroup item={item} {allServices} {onedit} {onremove} {ondragitem} {dragView} selectedChildIds={selectedChildIds} ontogglechild={ontogglechild} {gridGap} {query} {matchingIds} />
	{:else if loader}
		<LazyWidget {loader} props={widgetProps} />
	{:else if item.type === 'service' && !service}
		<div class="missing-service">{$t('dashboard.missingService')}</div>
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
