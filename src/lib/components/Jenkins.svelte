<script lang="ts">
	// Jenkins: the latest builds of one job (with a Run button for admins) or of
	// every job. A one-row tile shows the last build only.
	import type { JenkinsConfig } from '$lib/types';
	import EditButtons from './widget/EditButtons.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';
	import JenkinsBuilds from './jenkins/JenkinsBuilds.svelte';
	import JenkinsRun from './jenkins/JenkinsRun.svelte';
	import Glyph from '$lib/widgets/Glyph.svelte';
	import { pollJenkins } from './jenkins/pollJenkins.svelte';

	let { config, rowSpan = 3, ondelete, itemid }: {
		config?: JenkinsConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const job = $derived(config?.job ?? '');
	const compact = $derived(rowSpan <= 1);
	const poll = pollJenkins(() => ({ job, limit: compact ? 1 : (config?.limit ?? 8) }));
	const data = $derived(poll.data);
	const running = $derived(data?.builds.filter((b) => b.building).length ?? 0);
	const title = $derived(job ? job.split('/').pop() : 'Jenkins');

	let showEdit = $state(false);
</script>

<div class="jk-tile">
	<div class="jk-inner">
		<div class="jk-head">
			<span class="jk-icon"><Glyph name="jenkins" size={16} /></span>
			{#if data?.jobUrl}
				<a class="jk-title" href={data.jobUrl} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()} title={job}>{title}</a>
			{:else}
				<span class="jk-title" title={job || 'All projects'}>{title}</span>
			{/if}
			{#if !job && !compact}<span class="jk-sub">All projects</span>{/if}
			{#if data?.inQueue}<span class="jk-tag">queued</span>{:else if running}<span class="jk-tag run">{running} running</span>{/if}
			{#if job && data?.buildable !== false}
				<JenkinsRun {job} hasParameters={data?.hasParameters} onqueued={poll.refresh} />
			{/if}
		</div>
		{#if !data}
			<p class="jk-msg" class:err={!!poll.error}>{poll.error || 'Loading…'}</p>
		{:else if data.builds.length === 0}
			<p class="jk-msg">No build yet</p>
		{:else}
			<div class="jk-list">
				<JenkinsBuilds builds={data.builds} showJob={!job} dense={compact} />
			</div>
			{#if poll.error}<p class="jk-msg err small">{poll.error}</p>{/if}
		{/if}
	</div>
	<EditButtons label="Jenkins widget" {ondelete} onedit={() => (showEdit = true)} />
</div>

{#if showEdit}
	<WidgetEditModal type="jenkins" {itemid} {config} onclose={() => (showEdit = false)} />
{/if}

<style>
	.jk-tile {
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.jk-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		overflow: hidden;
		border-radius: inherit;
	}

	.jk-head {
		display: flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
		min-height: 24px;
	}

	.jk-icon {
		display: flex;
		color: var(--text-secondary);
	}

	.jk-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	a.jk-title:hover {
		color: var(--accent);
	}

	.jk-sub {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.jk-tag {
		margin-left: auto;
		padding: 1px 8px;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 600;
		background: color-mix(in srgb, var(--text-muted) 15%, transparent);
		color: var(--text-secondary);
	}

	.jk-tag.run {
		background: var(--accent-bg);
		color: var(--accent);
	}

	.jk-head > :global(.jr) {
		margin-left: auto;
	}

	.jk-tag + :global(.jr) {
		margin-left: 0;
	}

	.jk-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: none;
		margin: 0 -6px;
	}

	.jk-list::-webkit-scrollbar {
		display: none;
	}

	.jk-msg {
		margin: auto 0;
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.jk-msg.err {
		color: var(--danger);
	}

	.jk-msg.small {
		margin: 0;
		font-size: 0.7rem;
		text-align: left;
	}
</style>
