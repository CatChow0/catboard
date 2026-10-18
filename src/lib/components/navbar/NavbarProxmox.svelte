<script lang="ts">
	// Navbar Proxmox: guests running / total and the busiest node's CPU; click
	// for the nodes and guests (with the power buttons for admins).
	import type { ProxmoxConfig, ProxmoxData } from '$lib/types';
	import { isEditing } from '$lib/stores/dashboard';
	import { integrations, loadIntegrations } from '$lib/stores/integrations';
	import Glyph from '$lib/widgets/Glyph.svelte';
	import NavbarPopover from './NavbarPopover.svelte';
	import ProxmoxView from '../proxmox/ProxmoxView.svelte';
	import { pollJson } from '$lib/utils/pollJson.svelte';

	let { config }: { colSpan?: number; config?: ProxmoxConfig } = $props();

	// Cluster names come from the connections (loaded once per page).
	loadIntegrations();
	const clusterId = $derived(config?.clusterId ?? '');
	const poll = pollJson<ProxmoxData>(() => `/api/integrations/proxmox/resources?cluster=${encodeURIComponent(clusterId)}`, 15000);
	const data = $derived(poll.data);
	const name = $derived($integrations.proxmox?.clusters?.find((c) => c.id === clusterId)?.name || 'Proxmox');
	const guests = $derived(data?.guests.filter((g) => !config?.node || g.node === config.node) ?? []);
	const running = $derived(guests.filter((g) => g.status === 'running').length);
	const cpu = $derived(Math.round(Math.max(0, ...(data?.nodes.filter((n) => !config?.node || n.node === config.node).map((n) => n.cpu) ?? [0])) * 100));
	const label = $derived(data ? `${name}: ${running} of ${guests.length} guests running, CPU ${cpu}%` : name);

	let button = $state<HTMLButtonElement>();
	let open = $state(false);

	$effect(() => {
		if ($isEditing) open = false;
	});
</script>

<div class="nb-wrap">
	<button bind:this={button} class="px-widget" class:open class:editing={$isEditing} onclick={() => !$isEditing && (open = !open)} aria-expanded={open} aria-haspopup="dialog" title={label} aria-label="{label}, show the guests">
		<span class="nb-logo"><Glyph name="server" size={15} /></span>
		{#if !data}
			<span class="muted">{poll.error ? 'Error' : '…'}</span>
		{:else}
			<span class="dot"></span>
			<span class="name">{running}/{guests.length}</span>
			<span class="muted">CPU {cpu}%</span>
		{/if}
	</button>

	{#if open && button}
		<NavbarPopover anchor={button} {label} width={380} onclose={() => (open = false)}>
			<div class="pop">
				<p class="pop-title">{name}</p>
				{#if data}
					<ProxmoxView {data} {clusterId} {config} onchanged={poll.refresh} />
				{:else}
					<p class="nb-empty">{poll.error || 'Loading…'}</p>
				{/if}
			</div>
		</NavbarPopover>
	{/if}
</div>

<style>
	.nb-wrap {
		height: 100%;
		display: flex;
		align-items: center;
	}

	.px-widget {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 8px;
		height: 100%;
		min-height: 34px;
		width: 100%;
		white-space: nowrap;
		background: none;
		border: 0;
		border-radius: var(--radius-sm);
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: background var(--transition);
		overflow: hidden;
		font-variant-numeric: tabular-nums;
	}

	.px-widget:not(.editing):hover,
	.px-widget.open {
		background: var(--bg-card-hover);
	}

	.px-widget.editing {
		cursor: inherit;
	}

	.nb-logo {
		display: flex;
		flex-shrink: 0;
		color: var(--text-secondary);
		transform: scale(var(--nb-icon, 1));
	}

	.dot {
		width: calc(8px * var(--nb-icon, 1));
		height: calc(8px * var(--nb-icon, 1));
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--success, #22c55e);
	}

	.name {
		font-size: calc(0.78rem * var(--nb-text, 1));
		font-weight: 600;
		color: var(--text-primary);
	}

	.muted {
		font-size: calc(0.72rem * var(--nb-text, 1));
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pop {
		padding: 10px;
	}

	.pop-title {
		margin: 0 0 8px 6px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.nb-empty {
		margin: 0;
		padding: 8px;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
</style>
