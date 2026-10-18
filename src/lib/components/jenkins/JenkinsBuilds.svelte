<script lang="ts">
	// Build list shared by the Jenkins widget and the navbar popover: status
	// dot (or progress while running), project, number, when and how long.
	import type { JenkinsBuild } from '$lib/types';
	import { duration, timeAgo } from '$lib/utils/duration';

	let { builds, showJob = true, dense = false }: { builds: JenkinsBuild[]; showJob?: boolean; dense?: boolean } = $props();

	// Re-render the running bars every second.
	let now = $state(Date.now());
	$effect(() => {
		if (!builds.some((b) => b.building)) return;
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	const LABELS: Record<string, string> = { SUCCESS: 'Success', FAILURE: 'Failed', UNSTABLE: 'Unstable', ABORTED: 'Aborted', NOT_BUILT: 'Not built' };
	const statusOf = (b: JenkinsBuild) => (b.building ? 'running' : (b.result ?? 'NOT_BUILT').toLowerCase());
	const progress = (b: JenkinsBuild) => (b.estimatedDuration > 0 ? Math.min(99, ((now - b.timestamp) / b.estimatedDuration) * 100) : null);
	const shortName = (job: string) => job.split('/').pop() ?? job;
</script>

<ul class="jb" class:dense>
	{#each builds as b (b.job + '#' + b.number)}
		{@const p = b.building ? progress(b) : null}
		<li>
			<a href={b.url} target="_blank" rel="noopener noreferrer" onpointerdown={(e) => e.stopPropagation()} title="{b.job} #{b.number}: {b.building ? 'running' : LABELS[b.result ?? 'NOT_BUILT']}">
				<span class="dot {statusOf(b)}"></span>
				<span class="main">
					<span class="line">
						{#if showJob}<span class="job" title={b.job}>{shortName(b.job)}</span>{/if}
						<span class="num">#{b.number}</span>
						<span class="when">{b.building ? 'running' : timeAgo(new Date(b.timestamp).toISOString())}</span>
					</span>
					{#if b.building}
						<span class="bar" class:indeterminate={p === null}><span class="fill" style:width="{p ?? 30}%"></span></span>
					{/if}
				</span>
				<span class="dur">{b.building ? duration(Math.round((now - b.timestamp) / 1000)) : duration(Math.round(b.duration / 1000))}</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.jb {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;
		transition: background var(--transition);
	}

	a:hover {
		background: var(--bg-card-hover);
	}

	.dense a {
		padding: 4px 6px;
		gap: 8px;
	}

	.dot {
		width: 9px;
		height: 9px;
		flex-shrink: 0;
		border-radius: 50%;
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
		animation: jb-pulse 1.2s ease-in-out infinite;
	}

	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.line {
		display: flex;
		align-items: baseline;
		gap: 6px;
		min-width: 0;
		font-size: 0.82rem;
	}

	.job {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.num {
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
	}

	.when {
		margin-left: auto;
		font-size: 0.72rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.dur {
		font-size: 0.72rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		min-width: 42px;
		text-align: right;
	}

	.bar {
		height: 4px;
		border-radius: 2px;
		background: var(--border);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		background: var(--accent);
		transition: width 1s linear;
	}

	.indeterminate .fill {
		animation: jb-slide 1.4s ease-in-out infinite;
	}

	@keyframes jb-pulse {
		50% { opacity: 0.4; }
	}

	@keyframes jb-slide {
		from { transform: translateX(-100%); }
		to { transform: translateX(340%); }
	}
</style>
