<script lang="ts">
	// Nextcloud: the user's quota, server info (Nextcloud admins) and the
	// latest modified files, linking to Nextcloud. Every 2 min.
	import type { NextcloudConfig, NextcloudData } from '$lib/types';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import Glyph from '$lib/widgets/Glyph.svelte';
	import { bytes } from './stacker/format';
	import { timeAgo } from '$lib/utils/duration';
	import { pollJson } from '$lib/utils/pollJson.svelte';

	let { config, ondelete, itemid }: {
		config?: NextcloudConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const files = $derived(config?.files ?? 6);
	const showQuota = $derived(config?.showQuota !== false);
	const showServer = $derived(!!config?.showServer);
	const poll = pollJson<NextcloudData>(() => `/api/integrations/nextcloud/overview?server=${showServer ? 1 : 0}&files=${files}`, 120000);
	const data = $derived(poll.data);
	const quotaPct = $derived(data?.user.total ? Math.min(100, Math.round((data.user.used / data.user.total) * 100)) : null);

	let showEdit = $state(false);
</script>

<div class="nc-tile">
	<div class="nc-inner">
		<div class="nc-head">
			<span class="nc-icon"><Glyph name="cloud" size={16} /></span>
			{#if data}
				<a class="nc-title" href={data.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()}>Nextcloud</a>
				<span class="nc-sub">{data.user.name}</span>
			{:else}
				<span class="nc-title">Nextcloud</span>
			{/if}
		</div>
		{#if !data}
			<p class="nc-status" class:err={!!poll.error}>{poll.error || 'Loading…'}</p>
		{:else}
			{#if showQuota}
				<div class="nc-quota" title={data.user.total ? `${bytes(data.user.used)} of ${bytes(data.user.total)}` : `${bytes(data.user.used)} used, no quota`}>
					<div class="nc-quota-text">
						<span>{bytes(data.user.used)} used</span>
						<span class="muted">{data.user.total ? `of ${bytes(data.user.total)}` : 'no quota'}</span>
					</div>
					{#if quotaPct !== null}
						<span class="bar" class:warn={quotaPct >= 90}><span style="width: {quotaPct}%"></span></span>
					{/if}
				</div>
			{/if}
			{#if showServer && data.server}
				<div class="nc-server">
					{#if data.server.version}<span>v{data.server.version}</span>{/if}
					{#if data.server.activeUsers !== null}<span>{data.server.activeUsers} active today</span>{/if}
					{#if data.server.files !== null}<span>{data.server.files.toLocaleString()} files</span>{/if}
					{#if data.server.freeSpace !== null}<span>{bytes(data.server.freeSpace)} free</span>{/if}
				</div>
			{:else if showServer}
				<p class="nc-status small">Server info needs a Nextcloud admin and the Monitoring app.</p>
			{/if}
			{#if files > 0}
				<ul class="nc-files">
					{#each data.files as f (f.path)}
						<li>
							<a href={f.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()} title={f.path}>
								<span class="nc-name">{f.name}</span>
								<span class="muted">{timeAgo(new Date(f.modified).toISOString())}</span>
							</a>
						</li>
					{:else}
						<li class="nc-none">No file yet</li>
					{/each}
				</ul>
			{/if}
			{#if poll.error}<p class="nc-status err small">{poll.error}</p>{/if}
		{/if}
	</div>
	<EditButtons label="Nextcloud widget" {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="nextcloud" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.nc-tile {
		position: relative;
		height: 100%;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.nc-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.nc-head {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 24px;
		white-space: nowrap;
	}

	.nc-icon {
		display: flex;
		color: var(--text-secondary);
	}

	.nc-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	a.nc-title:hover {
		color: var(--accent);
	}

	.nc-sub,
	.muted {
		font-size: 0.72rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nc-quota {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.nc-quota-text {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.78rem;
	}

	.bar {
		height: 6px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--text-muted) 20%, transparent);
		overflow: hidden;
	}

	.bar > span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
	}

	.bar.warn > span {
		background: var(--warning, #f59e0b);
	}

	.nc-server {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		font-size: 0.72rem;
		color: var(--text-secondary);
	}

	.nc-files {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: none;
		list-style: none;
		margin: 0 -6px;
		padding: 0;
	}

	.nc-files::-webkit-scrollbar {
		display: none;
	}

	.nc-files a {
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

	.nc-files a:hover {
		background: var(--bg-card-hover);
	}

	.nc-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nc-none {
		padding: 6px;
		text-align: center;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.nc-status {
		margin: auto 0;
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.nc-status.err {
		color: var(--danger);
	}

	.nc-status.small {
		margin: 0;
		font-size: 0.7rem;
		text-align: left;
	}
</style>
