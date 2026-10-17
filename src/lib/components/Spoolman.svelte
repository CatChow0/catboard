<script lang="ts">
	// Spoolman: the list of available spools (scrollable), plus optional
	// "Recently used" and "Running low / empty" sections. "Show only" hides the
	// list and keeps just the enabled sections. A one-row tile shows a summary.
	import type { SpoolInfo, SpoolmanConfig, SpoolmanData } from '$lib/types';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import { spoolmanOrder, spoolmanSections } from '$lib/widgets/spoolman';
	import { timeAgo } from '$lib/utils/duration';

	let { config, rowSpan = 3, ondelete, itemid }: {
		config?: SpoolmanConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const POLL_MS = 60_000;

	const sections = $derived(spoolmanSections(config));

	const order = $derived(spoolmanOrder(config));
	const sort = $derived(config?.sort ?? 'name');
	const limit = $derived(config?.limit ?? 5);
	const lowPercent = $derived(config?.lowPercent ?? 15);
	const lowGrams = $derived(config?.lowGrams ?? 0);
	const archived = $derived(config?.includeArchived ?? false);
	const compact = $derived(rowSpan <= 1);

	let data = $state<SpoolmanData | null>(null);
	let error = $state('');

	$effect(() => {
		const q = `limit=${limit}&lowPercent=${lowPercent}&lowGrams=${lowGrams}&archived=${archived ? 1 : 0}&sort=${sort}`;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		async function load() {
			clearTimeout(timer);
			if (!document.hidden) {
				try {
					const res = await fetch(`/api/integrations/spoolman/spools?${q}`);
					const body = await res.json();
					if (stopped) return;
					if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
					data = body;
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

	/** Single colour, or hard-edged stripes for multi-colour filaments. */
	function swatch(s: SpoolInfo): string {
		if (!s.colors.length) return 'background: var(--text-muted)';
		if (s.colors.length === 1) return `background: ${s.colors[0]}`;
		const step = 360 / s.colors.length;
		return `background: conic-gradient(${s.colors.map((c, i) => `${c} ${i * step}deg ${(i + 1) * step}deg`).join(', ')})`;
	}

	const level = (s: SpoolInfo) => (s.remaining != null && s.remaining <= 1 ? 'empty' : s.percent != null && s.percent <= lowPercent ? 'low' : s.remaining != null && lowGrams > 0 && s.remaining <= lowGrams ? 'low' : 'ok');
	const grams = (g: number | null) => (g == null ? '–' : g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`);
	const meta = (s: SpoolInfo) => [s.vendor, s.material].filter(Boolean).join(' · ');
	const lowAndEmpty = $derived(data ? [...data.empty, ...data.low].slice(0, limit) : []);

	let showEdit = $state(false);
</script>

{#snippet row(s: SpoolInfo, kind: 'list' | 'recent' | 'low')}
	{@const lv = level(s)}
	<li class="sp-row">
		<span class="sp-swatch" style={swatch(s)} title={s.colors.join(', ') || 'No colour'}></span>
		<div class="sp-main">
			<div class="sp-line">
				<span class="sp-name" title={s.name}>{s.name}</span>
				{#if kind === 'low' || lv !== 'ok'}
					<span class="sp-badge {lv}">{lv === 'empty' ? 'Empty' : 'Low'}</span>
				{/if}
			</div>
			<div class="sp-bar"><div class="sp-fill {lv}" style:width="{s.percent ?? 0}%"></div></div>
			<div class="sp-meta">
				<span class="sp-sub">{meta(s)}{s.location ? ` · ${s.location}` : ''}</span>
				<span class="sp-weight">{grams(s.remaining)}{s.percent != null ? ` · ${Math.round(s.percent)}%` : ''}</span>
				{#if (kind === 'recent' || (kind === 'list' && sort === 'lastUsed')) && s.lastUsed}<span class="sp-when">{timeAgo(s.lastUsed)}</span>{/if}
			</div>
		</div>
	</li>
{/snippet}

<div class="sp-tile">
	<div class="sp-inner">
		<div class="sp-head">
			{#if data?.url}
				<a class="sp-title" href={data.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()}>{config?.title || 'Spoolman'}</a>
			{:else}
				<span class="sp-title">{config?.title || 'Spoolman'}</span>
			{/if}
			{#if data}
				<span class="sp-counts">
					{#if data.empty.length}<span class="empty">{data.empty.length} empty</span>{/if}
					{#if data.low.length}<span class="low">{data.low.length} low</span>{/if}
					<span>{data.available.length} available</span>
				</span>
			{/if}
		</div>

		{#if error && !data}
			<p class="sp-msg sp-error">{error}</p>
		{:else if !data}
			<p class="sp-msg">Loading…</p>
		{:else if compact}
			{@const first = sections.only && sections.recent ? data.recent[0] : data.available[0]}
			{#if first}
				<div class="sp-summary">
					<span class="sp-swatch" style={swatch(first)}></span>
					<span class="sp-name">{first.name}</span>
					<span class="sp-weight">{grams(first.remaining)}</span>
				</div>
			{/if}
		{:else}
			{#if error}<p class="sp-inline-error">{error}</p>{/if}
			<div class="sp-sections">
				{#each order as key (key)}
					{#if key === 'list' && !sections.only}
						<section>
							{#if sections.recent || sections.low}<h3>Spools</h3>{/if}
							{#if data.available.length}
								<ul class="sp-list">{#each data.available as s (s.id)}{@render row(s, 'list')}{/each}</ul>
							{:else}
								<p class="sp-msg">No spool with filament left</p>
							{/if}
						</section>
					{:else if key === 'recent' && sections.recent}
						<section>
							<h3>Recently used</h3>
							{#if data.recent.length}
								<ul class="sp-list">{#each data.recent as s (s.id)}{@render row(s, 'recent')}{/each}</ul>
							{:else}
								<p class="sp-msg">No spool used yet</p>
							{/if}
						</section>
					{:else if key === 'low' && sections.low}
						<section>
							<h3>Running low / empty</h3>
							{#if lowAndEmpty.length}
								<ul class="sp-list">{#each lowAndEmpty as s (s.id)}{@render row(s, 'low')}{/each}</ul>
							{:else}
								<p class="sp-msg ok">All spools have enough filament</p>
							{/if}
						</section>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
	<EditButtons label="Spoolman widget" {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="spoolman" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.sp-tile {
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.sp-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.sp-head {
		display: flex;
		align-items: center;
		gap: 10px;
		white-space: nowrap;
	}

	.sp-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		text-decoration: none;
		margin-right: auto;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	a.sp-title:hover {
		color: var(--accent);
	}

	.sp-counts {
		display: flex;
		gap: 8px;
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.sp-counts .low {
		color: var(--warning);
		font-weight: 600;
	}

	.sp-counts .empty {
		color: var(--danger);
		font-weight: 600;
	}

	.sp-sections {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: none;
	}

	.sp-sections::-webkit-scrollbar {
		display: none;
	}

	h3 {
		margin: 0 0 6px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.sp-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.sp-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		min-width: 0;
	}

	.sp-swatch {
		width: 14px;
		height: 14px;
		margin-top: 2px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25), 0 0 0 1px color-mix(in srgb, var(--text-muted) 35%, transparent);
	}

	.sp-main {
		flex: 1;
		min-width: 0;
	}

	.sp-line {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.sp-name {
		flex: 1;
		min-width: 0;
		font-size: 0.78rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sp-badge {
		flex-shrink: 0;
		padding: 0 6px;
		border-radius: 8px;
		font-size: 0.62rem;
		font-weight: 700;
	}

	.sp-badge.low {
		color: var(--warning);
		background: color-mix(in srgb, var(--warning) 18%, transparent);
	}

	.sp-badge.empty {
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 18%, transparent);
	}

	.sp-bar {
		height: 4px;
		margin: 3px 0;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.sp-fill {
		height: 100%;
		background: var(--success);
	}

	.sp-fill.low {
		background: var(--warning);
	}

	.sp-fill.empty {
		background: var(--danger);
	}

	.sp-meta {
		display: flex;
		gap: 8px;
		font-size: 0.68rem;
		color: var(--text-muted);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.sp-sub {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-right: auto;
	}

	.sp-weight {
		color: var(--text-secondary);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.sp-summary {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.sp-summary .sp-swatch {
		margin-top: 0;
	}

	.sp-msg {
		margin: 4px 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.sp-msg.ok {
		color: var(--success);
	}

	.sp-error,
	.sp-inline-error {
		color: var(--danger);
	}

	.sp-inline-error {
		margin: 0;
		font-size: 0.72rem;
	}
</style>
