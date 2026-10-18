<script lang="ts">
	// Proxmox nodes (CPU / RAM bars) and guests (state, usage), shared by the
	// grid and navbar widgets. Admins get start / shut down / reboot buttons;
	// shutting down or rebooting asks first.
	import type { ProxmoxData, ProxmoxGuest, ProxmoxConfig } from '$lib/types';
	import { currentUser } from '$lib/stores/dashboard';
	import { bytes } from '../stacker/format';
	import { duration } from '$lib/utils/duration';
	import WidgetModal from '../widget/WidgetModal.svelte';

	let { data, clusterId, config, onchanged, dense = false }: {
		data: ProxmoxData;
		clusterId: string;
		config?: ProxmoxConfig;
		onchanged?: () => void;
		dense?: boolean;
	} = $props();

	const isAdmin = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');
	const nodes = $derived(data.nodes.filter((n) => !config?.node || n.node === config.node));
	const guests = $derived(
		data.guests.filter(
			(g) =>
				(!config?.node || g.node === config.node) &&
				(!config?.kind || config.kind === 'all' || g.type === config.kind) &&
				(!config?.hideStopped || g.status === 'running')
		)
	);
	const multiNode = $derived(data.nodes.length > 1 && !config?.node);
	const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

	let busy = $state<number | null>(null);
	let message = $state<{ ok: boolean; text: string } | null>(null);
	let confirm = $state<{ guest: ProxmoxGuest; action: 'shutdown' | 'reboot' | 'stop' } | null>(null);

	function flash(ok: boolean, text: string) {
		message = { ok, text };
		setTimeout(() => (message = null), ok ? 3000 : 6000);
	}

	async function act(g: ProxmoxGuest, action: 'start' | 'shutdown' | 'reboot' | 'stop') {
		confirm = null;
		busy = g.vmid;
		try {
			const res = await fetch('/api/integrations/proxmox/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cluster: clusterId, node: g.node, type: g.type, vmid: g.vmid, action })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
			flash(true, `${g.name}: ${action} sent`);
			// The state changes within seconds: look again shortly.
			setTimeout(() => onchanged?.(), 2500);
		} catch (e) {
			flash(false, e instanceof Error ? e.message : String(e));
		} finally {
			busy = null;
		}
	}
</script>

{#if config?.showNodes !== false && nodes.length}
	<div class="px-nodes">
		{#each nodes as n (n.node)}
			<div class="px-node" class:offline={n.status !== 'online'} title="{n.node}: {n.status}, up {duration(n.uptime)}">
				<span class="px-node-name"><span class="dot {n.status === 'online' ? 'running' : 'stopped'}"></span>{n.node}</span>
				{#if n.status === 'online'}
					<span class="bar" title="CPU {Math.round(n.cpu * 100)}% of {n.maxcpu} cores"><span style="width: {Math.round(n.cpu * 100)}%"></span></span>
					<span class="px-num">{Math.round(n.cpu * 100)}%</span>
					<span class="bar mem" title="RAM {bytes(n.mem)} of {bytes(n.maxmem)}"><span style="width: {pct(n.mem, n.maxmem)}%"></span></span>
					<span class="px-num">{pct(n.mem, n.maxmem)}%</span>
				{:else}
					<span class="px-num off">offline</span>
				{/if}
			</div>
		{/each}
	</div>
{/if}

{#if message}<p class="px-msg" class:err={!message.ok}>{message.text}</p>{/if}

{#if guests.length === 0}
	<p class="px-empty">No guest{config?.hideStopped ? ' running' : ''}</p>
{:else}
	<ul class="px-guests" class:dense>
		{#each guests as g (g.node + g.vmid)}
			<li>
				<span class="dot {g.status === 'running' ? 'running' : g.status === 'paused' ? 'paused' : 'stopped'}" title={g.status}></span>
				<span class="px-id">{g.vmid}</span>
				<span class="px-name" title="{g.name} on {g.node}">{g.name}</span>
				<span class="px-tag">{g.type === 'lxc' ? 'CT' : 'VM'}</span>
				{#if multiNode && !dense}<span class="px-on">{g.node}</span>{/if}
				<span class="px-use">
					{#if g.status === 'running'}
						{Math.round(g.cpu * 100)}% · {bytes(g.mem)}
					{:else}
						{g.status}
					{/if}
				</span>
				{#if isAdmin}
					<span class="px-actions">
						{#if g.status === 'running'}
							<button onclick={() => (confirm = { guest: g, action: 'reboot' })} onpointerdown={(e) => e.stopPropagation()} disabled={busy === g.vmid} title="Reboot {g.name}" aria-label="Reboot {g.name}">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
							</button>
							<button onclick={() => (confirm = { guest: g, action: 'shutdown' })} onpointerdown={(e) => e.stopPropagation()} disabled={busy === g.vmid} title="Shut down {g.name}" aria-label="Shut down {g.name}">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.8 0" /></svg>
							</button>
						{:else if g.status === 'stopped'}
							<button class="start" onclick={() => act(g, 'start')} onpointerdown={(e) => e.stopPropagation()} disabled={busy === g.vmid} title="Start {g.name}" aria-label="Start {g.name}">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
							</button>
						{/if}
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

{#if confirm}
	{@const c = confirm}
	<WidgetModal
		title="{c.action === 'reboot' ? 'Reboot' : c.action === 'stop' ? 'Stop' : 'Shut down'} {c.guest.name}?"
		saveLabel={c.action === 'reboot' ? 'Reboot' : c.action === 'stop' ? 'Stop now' : 'Shut down'}
		onclose={() => (confirm = null)}
		onsave={() => act(c.guest, c.action)}
	>
		<p class="hint">
			{#if c.action === 'stop'}
				Stops {c.guest.type === 'lxc' ? 'container' : 'VM'} {c.guest.vmid} at once, like pulling the plug: unsaved data in it is lost.
			{:else}
				Asks {c.guest.type === 'lxc' ? 'container' : 'VM'} {c.guest.vmid} on {c.guest.node} to {c.action === 'reboot' ? 'restart' : 'shut down'} cleanly{c.guest.type === 'qemu' ? ' (needs the QEMU guest agent or ACPI)' : ''}.
			{/if}
		</p>
		{#if c.action !== 'stop'}
			<button class="btn-ghost" onclick={() => (confirm = { ...c, action: 'stop' })}>Force stop instead</button>
		{/if}
	</WidgetModal>
{/if}

<style>
	.px-nodes {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 6px;
	}

	.px-node {
		display: grid;
		grid-template-columns: minmax(60px, 1fr) 2fr 34px 2fr 34px;
		align-items: center;
		gap: 6px;
		font-size: 0.72rem;
	}

	.px-node-name {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bar {
		height: 5px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--text-muted) 20%, transparent);
		overflow: hidden;
	}

	.bar > span {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: inherit;
		transition: width 0.4s ease;
	}

	.bar.mem > span {
		background: var(--success, #22c55e);
	}

	.px-num {
		text-align: right;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.px-num.off {
		grid-column: 2 / -1;
		text-align: left;
		color: var(--danger);
	}

	.px-guests {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.px-guests li {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px;
		border-radius: var(--radius-sm);
		font-size: 0.78rem;
		white-space: nowrap;
	}

	.px-guests li:hover {
		background: var(--bg-card-hover);
	}

	.px-guests.dense li {
		padding: 2px 4px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--text-muted);
	}

	.dot.running {
		background: var(--success, #22c55e);
	}

	.dot.paused {
		background: var(--warning, #f59e0b);
	}

	.px-id {
		color: var(--text-muted);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
		min-width: 26px;
	}

	.px-name {
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		color: var(--text-primary);
	}

	.px-tag,
	.px-on {
		padding: 0 5px;
		border-radius: 4px;
		font-size: 0.62rem;
		font-weight: 600;
		background: color-mix(in srgb, var(--text-muted) 15%, transparent);
		color: var(--text-secondary);
	}

	.px-on {
		font-weight: 400;
	}

	.px-use {
		margin-left: auto;
		color: var(--text-muted);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
	}

	.px-actions {
		display: flex;
		gap: 2px;
	}

	.px-actions button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		transition: background var(--transition), color var(--transition);
	}

	.px-actions button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--text-primary);
	}

	.px-actions button.start:hover:not(:disabled) {
		color: var(--success, #22c55e);
	}

	.px-actions button:disabled {
		opacity: 0.4;
		cursor: progress;
	}

	.px-msg {
		margin: 0 0 4px;
		font-size: 0.72rem;
		color: var(--success, #22c55e);
	}

	.px-msg.err {
		color: var(--danger);
	}

	.px-empty {
		margin: auto 0;
		padding: 8px;
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
</style>
