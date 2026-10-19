<script lang="ts">
	// Streams currently playing on Jellyfin: who watches what, progress, and
	// whether it is played directly or transcoded.
	import { t } from '$lib/i18n';
	import { pollJson } from '$lib/utils/pollJson.svelte';
	import type { JellyfinSession } from '$lib/types';
	import EditButtons from './widget/EditButtons.svelte';

	let { rowSpan = 2, ondelete }: { config?: unknown; colSpan?: number; rowSpan?: number; ondelete?: () => void; itemid: string } = $props();

	const POLL_MS = 10_000;
	const compact = $derived(rowSpan === 1);

	const poll = pollJson<{ sessions?: JellyfinSession[] }>(() => '/api/integrations/jellyfin/sessions', POLL_MS);
	const sessions = $derived(poll.data?.sessions ?? []);
	const loading = $derived(!poll.data && !poll.error);
	const error = $derived(poll.error);

	const pct = (s: JellyfinSession) => (s.runtimeSec > 0 ? Math.min(100, (s.positionSec / s.runtimeSec) * 100) : 0);

	function clock(sec: number): string {
		const h = Math.floor(sec / 3600);
		const m = Math.floor((sec % 3600) / 60);
		const s = Math.floor(sec % 60);
		return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
	}

	const methodLabel = (s: JellyfinSession) => $t(s.playMethod === 'Transcode' ? 'jellyfin.transcode' : s.playMethod === 'DirectStream' ? 'jellyfin.directStream' : 'jellyfin.directPlay');
</script>

<div class="np-tile">
	<div class="np-inner">
		<div class="np-head" class:hidden={compact && sessions.length > 0}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
			<span>{$t('jellyfin.nowPlaying')}</span>
			{#if sessions.length}<span class="np-count">{sessions.length}</span>{/if}
		</div>

		{#if loading}
			<p class="np-msg">{$t('common.loading')}</p>
		{:else if error}
			<p class="np-msg np-error">{error}</p>
		{:else if sessions.length === 0}
			<p class="np-msg">{$t('jellyfin.nothing')}</p>
		{:else if compact}
			<ul class="np-lines">
				{#each sessions as s (s.id)}
					<li title="{s.user} · {s.device} · {methodLabel(s)}">
						<span class="np-state">{s.paused ? '❚❚' : '▶'}</span>
						<span class="np-line-title">{s.title}</span>
						<span class="np-line-user">{s.user}</span>
						<span class="np-line-pct">{Math.round(pct(s))}%</span>
					</li>
				{/each}
			</ul>
		{:else}
			<ul class="np-cards">
				{#each sessions as s (s.id)}
					<li class="np-card" style:background-image={s.imageUrl ? `url(${s.imageUrl})` : undefined}>
						<div class="np-shade"></div>
						<div class="np-body">
							<div class="np-top">
								<span class="np-badge" class:transcode={s.playMethod === 'Transcode'} title={s.transcodeInfo || methodLabel(s)}>{methodLabel(s)}</span>
								{#if s.paused}<span class="np-paused">{$t('jellyfin.paused')}</span>{/if}
							</div>
							<div class="np-title">{s.title}</div>
							{#if s.subtitle}<div class="np-sub">{s.subtitle}</div>{/if}
							<div class="np-meta">
								<span>{s.user}</span>
								<span class="np-dot">·</span>
								<span>{s.device || s.client}</span>
								<span class="np-time">{clock(s.positionSec)} / {clock(s.runtimeSec)}</span>
							</div>
							<div class="np-bar" role="progressbar" aria-valuenow={Math.round(pct(s))} aria-valuemin="0" aria-valuemax="100">
								<div class="np-fill" class:paused={s.paused} style:width="{pct(s)}%"></div>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
	<EditButtons label={$t('widget.lblNowPlaying')} {ondelete} />
</div>

<style>
	.np-tile {
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.np-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.np-head {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	/* One-row tiles: the stream lines need the room. */
	.np-head.hidden {
		display: none;
	}

	.np-head svg {
		color: var(--accent);
	}

	.np-count {
		margin-left: auto;
		font-size: 0.7rem;
		padding: 1px 7px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--accent);
	}

	.np-msg {
		margin: auto;
		font-size: 0.8rem;
		color: var(--text-muted);
		text-align: center;
	}

	.np-error {
		color: var(--danger);
	}

	.np-lines,
	.np-cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		overflow-y: auto;
		min-height: 0;
	}

	.np-lines {
		gap: 2px;
	}

	.np-lines li {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 0.78rem;
		white-space: nowrap;
	}

	.np-state {
		color: var(--accent);
		font-size: 0.7rem;
		width: 12px;
	}

	.np-line-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-primary);
	}

	.np-line-user,
	.np-line-pct {
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.np-card {
		position: relative;
		flex-shrink: 0;
		min-height: 92px;
		border-radius: var(--radius-sm);
		background-color: var(--bg-card);
		background-size: cover;
		background-position: center;
		overflow: hidden;
	}

	.np-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.6) 60%, rgba(0, 0, 0, 0.35) 100%);
	}

	.np-body {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		color: #fff;
	}

	.np-top {
		display: flex;
		gap: 6px;
		margin-bottom: 2px;
	}

	.np-badge,
	.np-paused {
		font-size: 0.62rem;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.np-badge {
		background: rgba(46, 204, 113, 0.85);
	}

	.np-badge.transcode {
		background: rgba(230, 126, 34, 0.9);
	}

	.np-paused {
		background: rgba(255, 255, 255, 0.2);
	}

	.np-title {
		font-size: 0.88rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.np-sub {
		font-size: 0.72rem;
		opacity: 0.8;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.np-meta {
		display: flex;
		gap: 4px;
		font-size: 0.7rem;
		opacity: 0.85;
		white-space: nowrap;
		overflow: hidden;
	}

	.np-dot {
		opacity: 0.6;
	}

	.np-time {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.np-bar {
		height: 3px;
		margin-top: 4px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 2px;
		overflow: hidden;
	}

	.np-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.5s linear;
	}

	.np-fill.paused {
		background: rgba(255, 255, 255, 0.6);
	}
</style>
