<script lang="ts">
	// Navbar Jenkins: one job's last build (dot, number, progress while running),
	// or for every job the number running and the projects whose last build
	// failed; click for the latest builds (and the Run button for admins).
	import type { JenkinsConfig } from '$lib/types';
	import { isEditing } from '$lib/stores/dashboard';
	import Glyph from '$lib/widgets/Glyph.svelte';
	import NavbarPopover from './NavbarPopover.svelte';
	import JenkinsBuilds from '../jenkins/JenkinsBuilds.svelte';
	import JenkinsRun from '../jenkins/JenkinsRun.svelte';
	import { pollJenkins } from '../jenkins/pollJenkins.svelte';

	let { config }: { colSpan?: number; config?: JenkinsConfig } = $props();

	const job = $derived(config?.job ?? '');
	const poll = pollJenkins(() => ({ job, limit: config?.limit ?? 8 }));
	const data = $derived(poll.data);
	const last = $derived(data?.builds[0]);
	const running = $derived(data?.builds.filter((b) => b.building).length ?? 0);
	const failing = $derived(data?.failing ?? []);
	const name = $derived(job ? (job.split('/').pop() ?? job) : 'Jenkins');
	const lastState = $derived(!last ? 'none' : last.building ? 'running' : (last.result ?? 'NOT_BUILT').toLowerCase());
	const label = $derived(job ? `${name}: ${last ? (last.building ? 'running' : (last.result ?? 'not built').toLowerCase()) : 'no build'}` : `Jenkins: ${running} running, ${failing.length ? `${failing.length} failing` : 'all passing'}`);

	let button = $state<HTMLButtonElement>();
	let open = $state(false);

	// Edit mode drags navbar items; never leave a popover hanging there.
	$effect(() => {
		if ($isEditing) open = false;
	});

	function toggle() {
		if ($isEditing) return;
		open = !open;
	}
</script>

<div class="nb-wrap">
	<button bind:this={button} class="jk-widget" class:open class:editing={$isEditing} onclick={toggle} aria-expanded={open} aria-haspopup="dialog" title={label} aria-label="{label}, show the latest builds">
		<span class="nb-logo"><Glyph name="jenkins" size={15} /></span>
		{#if !data}
			<span class="muted">{poll.error ? 'Error' : '…'}</span>
		{:else if job}
			<span class="dot {lastState}"></span>
			<span class="name">{name}</span>
			{#if last}<span class="muted">#{last.number}</span>{/if}
		{:else}
			{#if running}<span class="dot running"></span><span class="name">{running} running</span>{/if}
			{#if failing.length}
				<span class="dot failure"></span>
				<span class="muted fail" title="Failing: {failing.map((f) => `${f.job} #${f.number}`).join(', ')}">{failing[0].job.split('/').pop()}{failing.length > 1 ? ` +${failing.length - 1}` : ''}</span>
			{:else if !running}
				<span class="dot success"></span><span class="muted">All good</span>
			{/if}
		{/if}
	</button>

	{#if open && button}
		<NavbarPopover anchor={button} {label} width={360} onclose={() => (open = false)}>
			<div class="pop">
				<div class="pop-head">
					<span class="pop-title">{job || 'All projects'}</span>
					{#if job && data?.buildable !== false}<JenkinsRun {job} hasParameters={data?.hasParameters} onqueued={poll.refresh} />{/if}
				</div>
				{#if data?.builds.length}
					<JenkinsBuilds builds={data.builds} showJob={!job} />
				{:else}
					<p class="nb-empty">{poll.error || (data ? 'No build yet' : 'Loading…')}</p>
				{/if}
			</div>
		</NavbarPopover>
	{/if}
</div>

<style>
	.nb-wrap {
		height: 100%;
		display: flex;
		align-items: center;
	}

	.jk-widget {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 8px;
		height: 100%;
		min-height: 34px;
		width: 100%;
		white-space: nowrap;
		background: none;
		border: 0;
		border-radius: var(--radius-sm);
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: background var(--transition);
		overflow: hidden;
		font-variant-numeric: tabular-nums;
	}

	.jk-widget:not(.editing):hover,
	.jk-widget.open {
		background: var(--bg-card-hover);
	}

	.jk-widget.editing {
		cursor: inherit;
	}

	.nb-logo {
		display: flex;
		flex-shrink: 0;
		color: var(--text-secondary);
		transform: scale(var(--nb-icon, 1));
	}

	.name {
		font-size: calc(0.78rem * var(--nb-text, 1));
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.muted {
		font-size: calc(0.72rem * var(--nb-text, 1));
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.dot {
		width: calc(8px * var(--nb-icon, 1));
		height: calc(8px * var(--nb-icon, 1));
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--text-muted);
	}

	.dot.success {
		background: var(--success, #22c55e);
	}

	.dot.failure {
		background: var(--danger);
	}

	.dot.unstable {
		background: var(--warning, #f59e0b);
	}

	.dot.running {
		background: var(--accent);
		animation: nbj-pulse 1.2s ease-in-out infinite;
	}

	.pop {
		padding: 10px;
	}

	.pop-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 0 0 6px 6px;
	}

	.pop-title {
		font-size: 0.85rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nb-empty {
		margin: 0;
		padding: 8px;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	@keyframes nbj-pulse {
		50% { opacity: 0.4; }
	}
</style>
