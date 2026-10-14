<script lang="ts">
	import StatusDot from './StatusDot.svelte';
	import type { Service } from '$lib/stores/dashboard';
	import { serviceStatuses, isEditing } from '$lib/stores/dashboard';
	import { serviceIcons, iconKey, requestIcon } from '$lib/stores/icons';

	let { service, colSpan = 1, rowSpan = 1, onedit, ondelete }: {
		service: Service;
		colSpan?: number;
		rowSpan?: number;
		onedit?: () => void;
		ondelete?: () => void;
	} = $props();

	let status = $derived($serviceStatuses[service.id] || 'checking');

	// Icons come from the browser-side cache (memory + IndexedDB, filled by
	// grouped requests). undefined = loading, null = the server has none: then a
	// legacy icon name may still be one of the icons bundled in /icons, else the
	// initial is shown.
	let entry = $derived($serviceIcons.get(iconKey(service)));
	let legacy = $derived(service.icon && !service.icon.includes(':') ? service.icon : '');
	let localFailed = $state(false);
	let broken = $state(false);
	$effect(() => {
		requestIcon(service);
		localFailed = false;
		broken = false;
	});

	let initial = $derived(service.name ? service.name.charAt(0).toUpperCase() : '?');

	let cells = $derived(colSpan * rowSpan);

	let layout = $derived(
		rowSpan > colSpan ? 'vertical' :
		colSpan >= 2 && rowSpan >= 2 ? 'vertical' :
		colSpan >= 2 ? 'horizontal' : 'vertical'
	);

	let showText = $derived(cells >= 2);
	let showDesc = $derived(cells >= 4);

	let iconSize = $derived(
		cells <= 1 ? 28 :
		cells <= 2 ? 36 :
		cells <= 4 ? 48 :
		cells <= 6 ? 60 :
		72
	);

	let nameSize = $derived(
		cells <= 1 ? '0.75rem' :
		cells <= 2 ? '0.85rem' :
		cells <= 4 ? '0.95rem' :
		cells <= 6 ? '1.05rem' :
		'1.2rem'
	);

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="tile"
	class:vertical={layout === 'vertical'}
	class:horizontal={layout === 'horizontal'}
	role="link"
	tabindex="0"
	onclick={() => { if (!$isEditing) window.open(service.url, '_blank', 'noopener'); }}
	onkeydown={(e) => { if (!$isEditing && (e.key === 'Enter' || e.key === ' ')) window.open(service.url, '_blank', 'noopener'); }}
>
	<div class="tile-content">
		<div class="tile-icon">
			{#if entry && !broken}
				<img src={entry.src} alt={service.name} onerror={() => (broken = true)} style="width: {iconSize}px; height: {iconSize}px;" />
			{:else if entry === null && legacy && !localFailed}
				<img src="/icons/{legacy}.svg" alt={service.name} onerror={() => (localFailed = true)} style="width: {iconSize}px; height: {iconSize}px;" />
			{:else if entry === undefined && !broken}
				<!-- Loading: keep the space so the tile does not jump. -->
				<div class="tile-icon-pending" style="width: {iconSize}px; height: {iconSize}px;"></div>
			{:else}
				<div class="tile-initial" style="width: {iconSize}px; height: {iconSize}px; font-size: {iconSize * 0.5}px;">{initial}</div>
			{/if}
		</div>
		{#if showText}
			<div class="tile-text">
				<span class="tile-name" style="font-size: {nameSize};">{service.name}</span>
				{#if showDesc && service.description}
					<span class="tile-desc">{service.description}</span>
				{/if}
			</div>
		{/if}
	</div>
	<div class="status-corner">
		<StatusDot {status} />
	</div>
	{#if $isEditing}
		<button class="btn-delete" onclick={() => ondelete?.()} title="Remove from dashboard">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={() => onedit?.()} title="Edit service">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		text-decoration: none;
		color: inherit;
		transition: background var(--transition), border-color var(--transition), box-shadow var(--transition);
		overflow: visible;
		position: relative;
		height: 100%;
		padding: 12px;
		cursor: pointer;
	}

	.tile:hover {
		background: var(--bg-card-hover);
		border-color: var(--border-light);
		box-shadow: var(--shadow);
	}

	.tile-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		flex: 1;
		min-height: 0;
		min-width: 0;
		width: 100%;
	}

	.tile.vertical .tile-content {
		flex-direction: column;
		text-align: center;
	}

	.tile.horizontal .tile-content {
		flex-direction: row;
		text-align: left;
	}

	.tile-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tile-icon-pending {
		border-radius: 8px;
		background: color-mix(in srgb, var(--text-muted) 10%, transparent);
	}

	.tile-icon img {
		object-fit: contain;
	}

	.tile-initial {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--accent);
		color: white;
		font-weight: 700;
		flex-shrink: 0;
	}

	.tile-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		max-width: 100%;
	}

	.tile-name {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tile-desc {
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.75rem;
		margin-top: 2px;
	}

	.status-corner {
		position: absolute;
		top: 6px;
		right: 6px;
	}

	.btn-delete {
		position: absolute;
		top: -8px;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--danger);
		color: white;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.btn-edit {
		position: absolute;
		bottom: -8px;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--accent);
		color: white;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.tile:hover .btn-delete,
	.tile:hover .btn-edit {
		opacity: 1;
	}

	.btn-edit:hover {
		background: var(--accent-hover);
	}

	.btn-delete:hover {
		background: #c0392b;
	}
</style>