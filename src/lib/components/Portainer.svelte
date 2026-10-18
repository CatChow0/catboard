<script lang="ts">
	// Portainer: container counts per environment and the stacks, with start /
	// stop for admins (stopping asks first). Refreshed every 30 s.
	import type { PortainerConfig, PortainerData, PortainerStack } from '$lib/types';
	import { currentUser } from '$lib/stores/dashboard';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import WidgetModal from './widget/WidgetModal.svelte';
	import Glyph from '$lib/widgets/Glyph.svelte';
	import { pollJson } from '$lib/utils/pollJson.svelte';

	let { config, ondelete, itemid }: {
		config?: PortainerConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const poll = pollJson<PortainerData>(() => '/api/integrations/portainer/overview', 30000);
	const data = $derived(poll.data);
	const only = $derived(config?.endpointId ? Number(config.endpointId) : null);
	const endpoints = $derived(data?.endpoints.filter((e) => only === null || e.id === only) ?? []);
	const stacks = $derived(data?.stacks.filter((s) => only === null || s.endpointId === only) ?? []);
	const endpointName = (id: number) => data?.endpoints.find((e) => e.id === id)?.name ?? `#${id}`;
	const isAdmin = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');

	let busy = $state<number | null>(null);
	let message = $state<{ ok: boolean; text: string } | null>(null);
	let confirmStop = $state<PortainerStack | null>(null);
	let showEdit = $state(false);

	async function act(s: PortainerStack, action: 'start' | 'stop') {
		confirmStop = null;
		busy = s.id;
		message = { ok: true, text: `${action === 'start' ? 'Starting' : 'Stopping'} ${s.name}…` };
		try {
			const res = await fetch('/api/integrations/portainer/stack', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: s.id, endpointId: s.endpointId, action })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
			message = { ok: true, text: `${s.name} ${action === 'start' ? 'started' : 'stopped'}` };
			poll.refresh();
		} catch (e) {
			message = { ok: false, text: e instanceof Error ? e.message : String(e) };
		} finally {
			busy = null;
			setTimeout(() => (message = null), 5000);
		}
	}
</script>

<div class="pt-tile">
	<div class="pt-inner">
		<div class="pt-head">
			<span class="pt-icon"><Glyph name="stacks" size={16} /></span>
			{#if data}
				<a class="pt-title" href={data.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()}>Portainer</a>
			{:else}
				<span class="pt-title">Portainer</span>
			{/if}
		</div>
		{#if !data}
			<p class="pt-status" class:err={!!poll.error}>{poll.error || 'Loading…'}</p>
		{:else}
			<div class="pt-envs">
				{#each endpoints as e (e.id)}
					<div class="pt-env" class:down={!e.up}>
						<span class="dot" class:on={e.up}></span>
						<span class="pt-env-name">{e.name}</span>
						{#if e.up}
							<span class="pt-n run" title="Running containers">{e.running}</span>
							<span class="pt-n" title="Stopped containers">{e.stopped}</span>
							{#if e.unhealthy}<span class="pt-n bad" title="Unhealthy containers">{e.unhealthy}</span>{/if}
						{:else}
							<span class="pt-n bad">down</span>
						{/if}
					</div>
				{/each}
			</div>
			{#if message}<p class="pt-msg" class:err={!message.ok}>{message.text}</p>{/if}
			<ul class="pt-stacks">
				{#each stacks as s (s.id)}
					<li>
						<span class="dot" class:on={s.active}></span>
						<span class="pt-name" title={s.name}>{s.name}</span>
						{#if only === null && data.endpoints.length > 1}<span class="pt-tag">{endpointName(s.endpointId)}</span>{/if}
						<span class="pt-state">{s.active ? 'active' : 'inactive'}</span>
						{#if isAdmin && s.type !== 3}
							{#if s.active}
								<button onclick={() => (confirmStop = s)} onpointerdown={(e) => e.stopPropagation()} disabled={busy === s.id} title="Stop {s.name}" aria-label="Stop {s.name}">
									<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
								</button>
							{:else}
								<button class="start" onclick={() => act(s, 'start')} onpointerdown={(e) => e.stopPropagation()} disabled={busy === s.id} title="Start {s.name}" aria-label="Start {s.name}">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
								</button>
							{/if}
						{/if}
					</li>
				{:else}
					<li class="pt-none">No stack</li>
				{/each}
			</ul>
			{#if poll.error}<p class="pt-status err small">{poll.error}</p>{/if}
		{/if}
	</div>
	<EditButtons label="Portainer widget" {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if confirmStop}
	{@const s = confirmStop}
	<WidgetModal title="Stop {s.name}?" saveLabel="Stop" onclose={() => (confirmStop = null)} onsave={() => act(s, 'stop')}>
		<p class="hint">Stops every container of the stack {s.name} on {endpointName(s.endpointId)}. Start it again from here or from Portainer.</p>
	</WidgetModal>
{/if}

{#if showEdit}
	<WidgetEditModal type="portainer" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.pt-tile {
		position: relative;
		height: 100%;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.pt-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.pt-head {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 24px;
	}

	.pt-icon {
		display: flex;
		color: var(--text-secondary);
	}

	.pt-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	a.pt-title:hover {
		color: var(--accent);
	}

	.pt-envs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.pt-env {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 3px 8px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--text-muted) 10%, transparent);
		font-size: 0.74rem;
	}

	.pt-env-name {
		font-weight: 600;
	}

	.pt-n {
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}

	.pt-n.run {
		color: var(--success, #22c55e);
	}

	.pt-n.bad {
		color: var(--danger);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--text-muted);
	}

	.dot.on {
		background: var(--success, #22c55e);
	}

	.pt-stacks {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: none;
		list-style: none;
		margin: 0 -6px;
		padding: 0;
	}

	.pt-stacks::-webkit-scrollbar {
		display: none;
	}

	.pt-stacks li {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px;
		border-radius: var(--radius-sm);
		font-size: 0.78rem;
		white-space: nowrap;
	}

	.pt-stacks li:hover {
		background: var(--bg-card-hover);
	}

	.pt-name {
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.pt-tag {
		padding: 0 5px;
		border-radius: 4px;
		font-size: 0.62rem;
		background: color-mix(in srgb, var(--text-muted) 15%, transparent);
		color: var(--text-secondary);
	}

	.pt-state {
		margin-left: auto;
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.pt-stacks button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
	}

	.pt-stacks button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--danger);
	}

	.pt-stacks button.start:hover:not(:disabled) {
		color: var(--success, #22c55e);
	}

	.pt-stacks button:disabled {
		opacity: 0.4;
		cursor: progress;
	}

	.pt-none {
		justify-content: center;
		color: var(--text-muted);
	}

	.pt-msg {
		margin: 0;
		font-size: 0.72rem;
		color: var(--success, #22c55e);
	}

	.pt-msg.err,
	.pt-status.err {
		color: var(--danger);
	}

	.pt-status {
		margin: auto 0;
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.pt-status.small {
		margin: 0;
		font-size: 0.7rem;
		text-align: left;
	}
</style>
