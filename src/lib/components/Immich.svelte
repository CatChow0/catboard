<script lang="ts">
	// Immich: photo / video counts and storage, and a strip of the latest
	// photos (thumbnails proxied by CatBoard) linking to Immich. Every 5 min.
	import type { ImmichConfig, ImmichData } from '$lib/types';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import Glyph from '$lib/widgets/Glyph.svelte';
	import { bytes } from './stacker/format';
	import { pollJson } from '$lib/utils/pollJson.svelte';

	let { config, ondelete, itemid }: {
		config?: ImmichConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const photos = $derived(config?.photos ?? 8);
	const showStats = $derived(config?.showStats !== false);
	const poll = pollJson<ImmichData>(() => `/api/integrations/immich/summary?photos=${photos}`, 300000);
	const data = $derived(poll.data);
	const n = (v: number) => v.toLocaleString();

	let showEdit = $state(false);
</script>

<div class="im-tile">
	<div class="im-inner">
		<div class="im-head">
			<span class="im-icon"><Glyph name="photos" size={16} /></span>
			{#if data}
				<a class="im-title" href={data.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()}>Immich</a>
				{#if data.stats.scope === 'user'}<span class="im-sub">my library</span>{/if}
			{:else}
				<span class="im-title">Immich</span>
			{/if}
		</div>
		{#if !data}
			<p class="im-status" class:err={!!poll.error}>{poll.error || 'Loading…'}</p>
		{:else}
			{#if showStats}
				<div class="im-stats">
					<div><b>{n(data.stats.photos)}</b><span>photos</span></div>
					<div><b>{n(data.stats.videos)}</b><span>videos</span></div>
					{#if data.stats.usage !== null}<div><b>{bytes(data.stats.usage)}</b><span>storage</span></div>{/if}
				</div>
			{/if}
			{#if photos > 0}
				<div class="im-strip">
					{#each data.recent as p (p.id)}
						<a href="{data.url}/photos/{p.id}" target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()} title={new Date(p.date).toLocaleString()}>
							<img src="/api/integrations/immich/thumb/{p.id}" alt="" loading="lazy" draggable="false" />
						</a>
					{:else}
						<p class="im-status">No photo yet</p>
					{/each}
				</div>
			{/if}
			{#if poll.error}<p class="im-status err small">{poll.error}</p>{/if}
		{/if}
	</div>
	<EditButtons label="Immich widget" {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="immich" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.im-tile {
		position: relative;
		height: 100%;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.im-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.im-head {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 24px;
	}

	.im-icon {
		display: flex;
		color: var(--text-secondary);
	}

	.im-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	a.im-title:hover {
		color: var(--accent);
	}

	.im-sub {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.im-stats {
		display: flex;
		gap: 16px;
	}

	.im-stats div {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}

	.im-stats b {
		font-size: 1rem;
		font-variant-numeric: tabular-nums;
	}

	.im-stats span {
		font-size: 0.68rem;
		color: var(--text-muted);
	}

	.im-strip {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
		align-content: start;
		gap: 4px;
		overflow: hidden;
	}

	.im-strip a {
		display: block;
		aspect-ratio: 1;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
	}

	.im-strip img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 0.25s ease;
	}

	.im-strip a:hover img {
		transform: scale(1.06);
	}

	.im-status {
		margin: auto 0;
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
		grid-column: 1 / -1;
	}

	.im-status.err {
		color: var(--danger);
	}

	.im-status.small {
		margin: 0;
		font-size: 0.7rem;
		text-align: left;
	}
</style>
