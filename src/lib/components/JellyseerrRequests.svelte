<script lang="ts">
	// Jellyseerr / Overseerr media requests. Admins can approve or decline
	// pending requests from the tile.
	import { t, errorText, type Key } from '$lib/i18n';
	import type { JellyseerrData, JellyseerrRequest, JellyseerrRequestsConfig } from '$lib/types';
	import { currentUser } from '$lib/stores/dashboard';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';

	let { config, rowSpan = 3, ondelete, itemid }: {
		config?: JellyseerrRequestsConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const POLL_MS = 60_000;
	const filter = $derived(config?.filter ?? 'pending');
	const limit = $derived(config?.limit ?? 8);
	const isAdmin = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');
	const compact = $derived(rowSpan <= 1);

	let data = $state<JellyseerrData | null>(null);
	let error = $state('');
	let busy = $state<Set<number>>(new Set());
	let reload = $state(0);

	$effect(() => {
		const q = `filter=${filter}&take=${limit}`;
		void reload;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		async function load() {
			clearTimeout(timer);
			try {
				const res = await fetch(`/api/integrations/jellyseerr/requests?${q}`);
				const body = await res.json();
				if (stopped) return;
				if (!res.ok) throw new Error(errorText(body, res.status));
				data = body;
				error = '';
			} catch (e) {
				if (!stopped) error = e instanceof Error ? e.message : String(e);
			}
			if (!stopped) timer = setTimeout(load, POLL_MS);
		}
		load();
		return () => {
			stopped = true;
			clearTimeout(timer);
		};
	});

	async function act(r: JellyseerrRequest, action: 'approve' | 'decline') {
		busy = new Set([...busy, r.id]);
		try {
			const res = await fetch(`/api/integrations/jellyseerr/requests/${r.id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(errorText(body, res.status));
			reload++;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			const next = new Set(busy);
			next.delete(r.id);
			busy = next;
		}
	}

	const statusLabel: Record<string, Key> = {
		pending: 'requests.pending', approved: 'requests.approved', declined: 'requests.declined', processing: 'requests.processing', available: 'requests.available', failed: 'requests.failed'
	};

	function ago(iso: string): string {
		const d = (Date.now() - new Date(iso).getTime()) / 1000;
		if (d < 3600) return $t('time.minAgo', { n: Math.max(1, Math.round(d / 60)) });
		if (d < 86400) return $t('time.hAgo', { n: Math.round(d / 3600) });
		return $t('time.dAgo', { n: Math.round(d / 86400) });
	}

	let showEdit = $state(false);
</script>

<div class="js-tile">
	<div class="js-inner">
		<div class="js-head">
			<span class="js-title">{filter === 'pending' ? 'Pending requests' : 'Requests'}</span>
			{#if data}
				<span class="js-counts">
					<span class="c pending" title={$t('requests.pending')}>{data.counts.pending}</span>
					<span class="c processing" title={$t('requests.processing')}>{data.counts.processing}</span>
					<span class="c available" title={$t('requests.available')}>{data.counts.available}</span>
				</span>
			{/if}
		</div>

		{#if error && !data}
			<p class="js-msg js-error">{error}</p>
		{:else if !data}
			<p class="js-msg">{$t('common.loading')}</p>
		{:else if data.requests.length === 0}
			<p class="js-msg">{filter === 'pending' ? 'No pending requests' : 'No requests yet'}</p>
		{:else if !compact}
			{#if error}<p class="js-inline-error">{error}</p>{/if}
			<ul class="js-list">
				{#each data.requests as r (r.id)}
					<li class="js-row">
						{#if r.posterUrl}
							<img class="js-poster" src={r.posterUrl} alt="" loading="lazy" />
						{:else}
							<div class="js-poster js-noposter"></div>
						{/if}
						<div class="js-info">
							<div class="js-name" title={r.title}>{r.title}{#if r.year}{' '}<span class="js-year">({r.year})</span>{/if}</div>
							<div class="js-meta">
								<span class="js-type">{r.mediaType === 'tv' ? 'Series' : 'Movie'}</span>
								<span>{r.requestedBy}, {ago(r.createdAt)}</span>
							</div>
						</div>
						{#if r.status === 'pending' && isAdmin}
							<div class="js-actions">
								<button class="js-btn approve" disabled={busy.has(r.id)} onclick={() => act(r, 'approve')} title={$t('requests.approve')} aria-label={$t('requests.approveNamed', { title: r.title })}>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5" /></svg>
								</button>
								<button class="js-btn decline" disabled={busy.has(r.id)} onclick={() => act(r, 'decline')} title={$t('requests.decline')} aria-label={$t('requests.declineNamed', { title: r.title })}>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
								</button>
							</div>
						{:else}
							<span class="js-status {r.status}">{statusLabel[r.status] ? $t(statusLabel[r.status]) : r.status}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
	<EditButtons label={$t('widget.lblRequests')} {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="jellyseerr-requests" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.js-tile {
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.js-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.js-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.js-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.js-counts {
		margin-left: auto;
		display: flex;
		gap: 4px;
	}

	.c {
		font-size: 0.68rem;
		font-weight: 700;
		padding: 1px 7px;
		border-radius: 10px;
		font-variant-numeric: tabular-nums;
	}

	.c.pending {
		background: color-mix(in srgb, var(--warning) 22%, transparent);
		color: var(--warning);
	}

	.c.processing {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		color: var(--accent);
	}

	.c.available {
		background: color-mix(in srgb, var(--success) 22%, transparent);
		color: var(--success);
	}

	.js-msg {
		margin: auto;
		font-size: 0.8rem;
		color: var(--text-muted);
		text-align: center;
	}

	.js-error,
	.js-inline-error {
		color: var(--danger);
	}

	.js-inline-error {
		margin: 0;
		font-size: 0.72rem;
	}

	.js-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		overflow-y: auto;
		min-height: 0;
	}

	.js-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.js-poster {
		width: 34px;
		height: 51px;
		flex-shrink: 0;
		border-radius: 3px;
		object-fit: cover;
		background: var(--bg-card);
	}

	.js-info {
		flex: 1;
		min-width: 0;
	}

	.js-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.js-year {
		font-weight: 400;
		color: var(--text-muted);
	}

	.js-meta {
		display: flex;
		gap: 6px;
		align-items: center;
		font-size: 0.7rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
	}

	.js-type {
		padding: 0 5px;
		border: 1px solid var(--border-light);
		border-radius: 3px;
	}

	.js-actions {
		display: flex;
		gap: 4px;
	}

	.js-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		transition: background var(--transition);
	}

	.js-btn.approve {
		color: var(--success);
		background: color-mix(in srgb, var(--success) 14%, transparent);
	}

	.js-btn.approve:hover:not(:disabled) {
		background: color-mix(in srgb, var(--success) 28%, transparent);
	}

	.js-btn.decline {
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 14%, transparent);
	}

	.js-btn.decline:hover:not(:disabled) {
		background: color-mix(in srgb, var(--danger) 28%, transparent);
	}

	.js-btn:disabled {
		opacity: 0.4;
	}

	.js-status {
		font-size: 0.66rem;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 10px;
		white-space: nowrap;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 15%, transparent);
	}

	.js-status.available {
		color: var(--success);
		background: color-mix(in srgb, var(--success) 18%, transparent);
	}

	.js-status.processing,
	.js-status.approved {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.js-status.pending {
		color: var(--warning);
		background: color-mix(in srgb, var(--warning) 18%, transparent);
	}

	.js-status.declined,
	.js-status.failed {
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 18%, transparent);
	}
</style>
