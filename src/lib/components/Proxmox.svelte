<script lang="ts">
	// Proxmox VE: node load and the VMs / containers of a cluster, refreshed
	// every 15 s while the page is visible.
	import { t } from '$lib/i18n';
	import type { ProxmoxConfig, ProxmoxData } from '$lib/types';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import ProxmoxView from './proxmox/ProxmoxView.svelte';
	import Glyph from '$lib/widgets/Glyph.svelte';
	import { integrations, loadIntegrations } from '$lib/stores/integrations';
	import { pollJson } from '$lib/utils/pollJson.svelte';

	let { config, rowSpan = 3, ondelete, itemid }: {
		config?: ProxmoxConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	// Cluster names come from the connections (loaded once per page).
	loadIntegrations();
	const clusterId = $derived(config?.clusterId ?? '');
	const poll = pollJson<ProxmoxData>(() => `/api/integrations/proxmox/resources?cluster=${encodeURIComponent(clusterId)}`, 15000);
	const data = $derived(poll.data);
	const name = $derived($integrations.proxmox?.clusters?.find((c) => c.id === clusterId)?.name || 'Proxmox');
	const running = $derived(data?.guests.filter((g) => g.status === 'running').length ?? 0);

	let showEdit = $state(false);
</script>

<div class="px-tile">
	<div class="px-inner">
		<div class="px-head">
			<span class="px-icon"><Glyph name="server" size={16} /></span>
			{#if data}
				<a class="px-title" href={data.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()}>{name}</a>
				<span class="px-count" title={$t('proxmox.runningTitle', { running, total: data.guests.length })}>{$t('proxmox.runningShort', { running, total: data.guests.length })}</span>
			{:else}
				<span class="px-title">{name}</span>
			{/if}
		</div>
		{#if !data}
			<p class="px-status" class:err={!!poll.error}>{poll.error || $t('common.loading')}</p>
		{:else}
			<div class="px-body">
				<ProxmoxView {data} {clusterId} {config} onchanged={poll.refresh} dense={rowSpan <= 2} />
			</div>
			{#if poll.error}<p class="px-status err small">{poll.error}</p>{/if}
		{/if}
	</div>
	<EditButtons label={$t('widget.lblProxmox')} {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="proxmox" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.px-tile {
		position: relative;
		height: 100%;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.px-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.px-head {
		display: flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
		min-height: 24px;
	}

	.px-icon {
		display: flex;
		color: var(--text-secondary);
	}

	.px-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	a.px-title:hover {
		color: var(--accent);
	}

	.px-count {
		margin-left: auto;
		padding: 1px 8px;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 600;
		background: color-mix(in srgb, var(--success, #22c55e) 15%, transparent);
		color: var(--success, #22c55e);
	}

	.px-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		scrollbar-width: none;
		margin: 0 -6px;
		padding: 0 6px;
	}

	.px-body::-webkit-scrollbar {
		display: none;
	}

	.px-status {
		margin: auto 0;
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.px-status.err {
		color: var(--danger);
	}

	.px-status.small {
		margin: 0;
		font-size: 0.7rem;
		text-align: left;
	}
</style>
