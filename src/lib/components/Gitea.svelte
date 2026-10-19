<script lang="ts">
	// Gitea / Forgejo: the user's recently updated repositories, and the open
	// issues and pull requests of the repositories the token reads, with their
	// totals. Links open Gitea. Every 2 min.
	import { t } from '$lib/i18n';
	import type { GiteaConfig, GiteaData } from '$lib/types';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import Glyph from '$lib/widgets/Glyph.svelte';
	import { timeAgo } from '$lib/utils/duration';
	import { pollJson } from '$lib/utils/pollJson.svelte';

	let { config, ondelete, itemid }: {
		config?: GiteaConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const repos = $derived(config?.repos ?? 5);
	const issues = $derived(config?.issues ?? 5);
	const poll = pollJson<GiteaData>(() => `/api/integrations/gitea/overview?repos=${repos}&issues=${issues}`, 120000);
	const data = $derived(poll.data);
	const ago = (ms: number) => timeAgo(new Date(ms).toISOString());

	let showEdit = $state(false);
</script>

<div class="gt-tile">
	<div class="gt-inner">
		<div class="gt-head">
			<span class="gt-icon"><Glyph name="git" size={16} /></span>
			{#if data}
				<a class="gt-title" href={data.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()}>Gitea</a>
				<span class="muted">{data.user}</span>
			{:else}
				<span class="gt-title">Gitea</span>
			{/if}
			{#if data?.counts}
				<span class="gt-counts">
					<span title={$t('gitea.openIssues')}>{$t('gitea.nIssues', { count: data.counts.issues })}</span>
					<span title={$t('gitea.openPulls')}>{$t('gitea.nPulls', { count: data.counts.pulls })}</span>
				</span>
			{/if}
		</div>
		{#if !data}
			<p class="gt-status" class:err={!!poll.error}>{poll.error || $t('common.loading')}</p>
		{:else}
			<div class="gt-lists">
				{#if repos > 0}
					<section>
						<h4>{$t('gitea.repos')}</h4>
						<ul>
							{#each data.repos as r (r.name)}
								<li>
									<a href={r.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()} title={r.name}>
										<span class="gt-name">{r.name}{#if r.private} <span class="gt-lock" title={$t('gitea.private')}>●</span>{/if}</span>
										{#if r.issues || r.pulls}<span class="muted">{r.issues + r.pulls}</span>{/if}
										<span class="muted">{ago(r.updated)}</span>
									</a>
								</li>
							{:else}
								<li class="gt-none">{$t('gitea.noRepo')}</li>
							{/each}
						</ul>
					</section>
				{/if}
				{#if issues > 0}
					<section>
						<h4>{$t('gitea.open')}</h4>
						<ul>
							{#each data.open as i (i.url)}
								<li>
									<a href={i.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()} title="{i.repo}#{i.number} · {i.author}">
										<span class="gt-kind" class:pull={i.pull}>{i.pull ? $t('gitea.pr') : $t('gitea.issue')}</span>
										<span class="gt-name">{i.title}</span>
										<span class="muted">{i.repo.split('/').pop()}#{i.number}</span>
									</a>
								</li>
							{:else}
								<li class="gt-none">{$t('gitea.nothingOpen')}</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>
			{#if poll.error}<p class="gt-status err small">{poll.error}</p>{/if}
		{/if}
	</div>
	<EditButtons label={$t('widget.lblGitea')} {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="gitea" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.gt-tile {
		position: relative;
		height: 100%;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.gt-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.gt-head {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 24px;
		white-space: nowrap;
	}

	.gt-icon {
		display: flex;
		color: var(--text-secondary);
	}

	.gt-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	a.gt-title:hover {
		color: var(--accent);
	}

	.muted {
		font-size: 0.72rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		flex-shrink: 0;
	}

	.gt-counts {
		margin-left: auto;
		display: flex;
		gap: 8px;
		font-size: 0.72rem;
		color: var(--text-secondary);
	}

	.gt-lists {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow-y: auto;
		scrollbar-width: none;
	}

	.gt-lists::-webkit-scrollbar {
		display: none;
	}

	h4 {
		margin: 0 0 2px;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}

	ul {
		list-style: none;
		margin: 0 -6px;
		padding: 0;
	}

	li a {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 6px;
		border-radius: var(--radius-sm);
		font-size: 0.78rem;
		color: var(--text-primary);
		text-decoration: none;
		white-space: nowrap;
	}

	li a:hover {
		background: var(--bg-card-hover);
	}

	.gt-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.gt-lock {
		font-size: 0.5rem;
		vertical-align: middle;
		color: var(--warning, #f59e0b);
	}

	.gt-kind {
		flex-shrink: 0;
		padding: 0 5px;
		border-radius: 4px;
		font-size: 0.62rem;
		font-weight: 600;
		color: var(--success, #22c55e);
		background: color-mix(in srgb, var(--success, #22c55e) 15%, transparent);
	}

	.gt-kind.pull {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 15%, transparent);
	}

	.gt-none {
		padding: 6px;
		text-align: center;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.gt-status {
		margin: auto 0;
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.gt-status.err {
		color: var(--danger);
	}

	.gt-status.small {
		margin: 0;
		font-size: 0.7rem;
		text-align: left;
	}
</style>
