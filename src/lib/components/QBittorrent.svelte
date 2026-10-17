<script lang="ts">
	// qBittorrent: speeds (with a 60 s graph), counters and the busiest
	// torrents. Admins can pause/resume single torrents or everything.
	import type { QBittorrentConfig, QBittorrentData, Torrent } from '$lib/types';
	import { currentUser } from '$lib/stores/dashboard';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import StackerGraph from './stacker/StackerGraph.svelte';
	import { bytes, bytesRate, niceMax } from './stacker/format';

	let { config, rowSpan = 3, ondelete, itemid }: {
		config?: QBittorrentConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const POLL_MS = 3000;
	const HISTORY = 20; // ~60 s of speed history
	const filter = $derived(config?.filter ?? 'active');
	const limit = $derived(config?.limit ?? 8);
	const isAdmin = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');
	const compact = $derived(rowSpan <= 1);
	const showGraph = $derived(rowSpan >= 3);

	let data = $state<QBittorrentData | null>(null);
	let error = $state('');
	let history = $state<{ t: number; dl: number; ul: number }[]>([]);
	let busy = $state(false);
	let reload = $state(0);

	$effect(() => {
		const q = `filter=${filter}&limit=${limit}`;
		void reload;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		async function load() {
			clearTimeout(timer);
			if (!document.hidden) {
				try {
					const res = await fetch(`/api/integrations/qbittorrent/status?${q}`);
					const body = await res.json();
					if (stopped) return;
					if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
					data = body;
					history = [...history, { t: Date.now(), dl: body.dlSpeed, ul: body.upSpeed }].slice(-HISTORY);
					error = '';
				} catch (e) {
					if (!stopped) error = e instanceof Error ? e.message : String(e);
				}
			}
			if (!stopped) timer = setTimeout(load, POLL_MS);
		}
		const onVisible = () => !document.hidden && load();
		document.addEventListener('visibilitychange', onVisible);
		load();
		return () => {
			stopped = true;
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	const graphMax = $derived(niceMax(Math.max(0, ...history.map((h) => Math.max(h.dl, h.ul))), 1 << 20));
	const allPaused = $derived(!!data && data.total > 0 && data.counts.downloading + data.counts.seeding + data.counts.stalled + data.counts.checking + data.counts.queued === 0);

	async function act(action: 'pause' | 'resume', hashes: string[] | 'all') {
		busy = true;
		try {
			const res = await fetch('/api/integrations/qbittorrent/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, hashes })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
			reload++;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	const isPaused = (t: Torrent) => t.state === 'paused' || t.state === 'completed';

	function eta(sec: number): string {
		if (sec < 0) return '∞';
		if (sec < 60) return `${sec}s`;
		if (sec < 3600) return `${Math.round(sec / 60)}m`;
		if (sec < 86400) return `${Math.floor(sec / 3600)}h${String(Math.round((sec % 3600) / 60)).padStart(2, '0')}`;
		return `${Math.round(sec / 86400)}d`;
	}

	const stateLabel: Record<string, string> = {
		downloading: 'Downloading', seeding: 'Seeding', paused: 'Paused', queued: 'Queued', checking: 'Checking', stalled: 'Stalled', error: 'Error', completed: 'Completed'
	};

	let showEdit = $state(false);
</script>

<div class="qb-tile">
	<div class="qb-inner">
		<div class="qb-head">
			<span class="qb-title">qBittorrent</span>
			{#if data}
				<span class="qb-speed dl" title="Download">↓ {bytesRate(data.dlSpeed)}</span>
				<span class="qb-speed ul" title="Upload">↑ {bytesRate(data.upSpeed)}</span>
				{#if isAdmin && data.total > 0}
					<button class="qb-global" disabled={busy} onclick={() => act(allPaused ? 'resume' : 'pause', 'all')} title={allPaused ? 'Resume all' : 'Pause all'} aria-label={allPaused ? 'Resume all torrents' : 'Pause all torrents'}>
						{#if allPaused}
							<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
						{:else}
							<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
						{/if}
					</button>
				{/if}
			{/if}
		</div>

		{#if error && !data}
			<p class="qb-msg qb-error">{error}</p>
		{:else if !data}
			<p class="qb-msg">Loading…</p>
		{:else}
			{#if error}<p class="qb-inline-error">{error}</p>{/if}
			{#if showGraph}
				<div class="qb-graph">
					<StackerGraph
						t={history.map((h) => h.t)}
						windowMs={HISTORY * POLL_MS}
						interval={POLL_MS}
						max={graphMax}
						label="Download (solid) and upload (dashed) speed"
						series={[
							{ values: history.map((h) => h.dl), color: '--qb-dl', fill: true },
							{ values: history.map((h) => h.ul), color: '--qb-ul', dashed: true }
						]}
					/>
				</div>
			{/if}
			{#if !compact}
				<div class="qb-counts">
					<span><b>{data.counts.downloading + data.counts.stalled}</b> downloading</span>
					<span><b>{data.counts.seeding}</b> seeding</span>
					<span><b>{data.counts.paused + data.counts.completed}</b> paused</span>
					{#if data.counts.error}<span class="err"><b>{data.counts.error}</b> errors</span>{/if}
				</div>
				{#if data.torrents.length === 0}
					<p class="qb-msg">{filter === 'active' ? 'Nothing active right now' : 'No torrents'}</p>
				{:else}
					<ul class="qb-list">
						{#each data.torrents as t (t.hash)}
							<li class="qb-row">
								<div class="qb-line">
									<span class="qb-name" title={t.name}>{t.name}</span>
									{#if isAdmin}
										<button class="qb-btn" disabled={busy} onclick={() => act(isPaused(t) ? 'resume' : 'pause', [t.hash])} title={isPaused(t) ? 'Resume' : 'Pause'} aria-label="{isPaused(t) ? 'Resume' : 'Pause'} {t.name}">
											{#if isPaused(t)}
												<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
											{:else}
												<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
											{/if}
										</button>
									{/if}
								</div>
								<div class="qb-bar"><div class="qb-fill {t.state}" style:width="{t.progress * 100}%"></div></div>
								<div class="qb-meta">
									<span class="qb-state {t.state}">{stateLabel[t.state]}</span>
									<span>{(t.progress * 100).toFixed(t.progress < 1 ? 1 : 0)}% of {bytes(t.size)}</span>
									{#if t.dlSpeed > 0}<span>↓ {bytesRate(t.dlSpeed)}</span>{/if}
									{#if t.upSpeed > 0}<span>↑ {bytesRate(t.upSpeed)}</span>{/if}
									{#if t.progress < 1 && t.state === 'downloading'}<span class="qb-eta">{eta(t.eta)}</span>{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		{/if}
	</div>
	<EditButtons label="qBittorrent widget" {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="qbittorrent" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.qb-tile {
		--qb-dl: #3fb6ff;
		--qb-ul: #48d48c;
		--st-line: var(--border);
		--st-grid: color-mix(in srgb, var(--text-muted) 20%, transparent);
		--st-panel-2: color-mix(in srgb, var(--bg-primary) 55%, transparent);
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.qb-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.qb-head {
		display: flex;
		align-items: center;
		gap: 10px;
		white-space: nowrap;
	}

	.qb-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-right: auto;
	}

	.qb-speed {
		font-size: 0.75rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.qb-speed.dl {
		color: var(--qb-dl);
	}

	.qb-speed.ul {
		color: var(--qb-ul);
	}

	.qb-global,
	.qb-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		background: color-mix(in srgb, var(--text-muted) 14%, transparent);
		transition: background var(--transition), color var(--transition);
	}

	.qb-global {
		width: 26px;
		height: 22px;
	}

	.qb-btn {
		width: 22px;
		height: 18px;
		flex-shrink: 0;
	}

	.qb-global:hover:not(:disabled),
	.qb-btn:hover:not(:disabled) {
		color: var(--text-primary);
		background: color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.qb-graph {
		display: flex;
		height: 56px;
		flex-shrink: 0;
	}

	.qb-msg {
		margin: auto;
		font-size: 0.8rem;
		color: var(--text-muted);
		text-align: center;
	}

	.qb-error,
	.qb-inline-error {
		color: var(--danger);
	}

	.qb-inline-error {
		margin: 0;
		font-size: 0.72rem;
	}

	.qb-counts {
		display: flex;
		gap: 12px;
		font-size: 0.72rem;
		color: var(--text-muted);
		flex-wrap: wrap;
	}

	.qb-counts b {
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.qb-counts .err b {
		color: var(--danger);
	}

	.qb-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow-y: auto;
		min-height: 0;
	}

	.qb-line {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.qb-name {
		flex: 1;
		min-width: 0;
		font-size: 0.78rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.qb-bar {
		height: 4px;
		margin: 3px 0;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.qb-fill {
		height: 100%;
		background: var(--text-muted);
		transition: width 0.6s ease;
	}

	.qb-fill.downloading {
		background: var(--qb-dl);
	}

	.qb-fill.seeding,
	.qb-fill.completed {
		background: var(--qb-ul);
	}

	.qb-fill.stalled,
	.qb-fill.queued {
		background: var(--warning);
	}

	.qb-fill.error {
		background: var(--danger);
	}

	.qb-meta {
		display: flex;
		gap: 8px;
		font-size: 0.68rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		font-variant-numeric: tabular-nums;
	}

	.qb-state.downloading {
		color: var(--qb-dl);
	}

	.qb-state.seeding {
		color: var(--qb-ul);
	}

	.qb-state.error {
		color: var(--danger);
	}

	.qb-eta {
		margin-left: auto;
	}
</style>
