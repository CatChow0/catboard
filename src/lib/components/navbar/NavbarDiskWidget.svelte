<script lang="ts">
	import { systemStats } from '$lib/stores/dashboard';

	let { config, colSpan = 2 }: { config: { disks: string[]; pageIndicatorSide?: 'left' | 'right' }; colSpan?: number } = $props();

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb < 1) return `${Math.round(bytes / (1024 * 1024))} MB`;
		return `${gb.toFixed(1)} GB`;
	}

	const VISIBLE = 3;
	let page = $state(0);

	const diskEntries = $derived(() => {
		const entries: { path: string; total: number; used: number; pct: number }[] = [];
		const stats = $systemStats.disks;
		const configuredPaths = config?.disks || [];

		if (configuredPaths.length > 0) {
			for (const path of configuredPaths) {
				const d = stats[path];
				if (d) {
					const pct = d.total > 0 ? Math.round((d.used / d.total) * 100) : 0;
					entries.push({ path, total: d.total, used: d.used, pct });
				}
			}
		}

		if (entries.length === 0 && Object.keys(stats).length > 0) {
			for (const [path, d] of Object.entries(stats)) {
				const pct = d.total > 0 ? Math.round((d.used / d.total) * 100) : 0;
				entries.push({ path, total: d.total, used: d.used, pct });
			}
		}

		return entries;
	});

	const totalPages = $derived(Math.max(1, Math.ceil(diskEntries().length / VISIBLE)));

	const visibleDisks = $derived(() => {
		const entries = diskEntries();
		const start = page * VISIBLE;
		const slice = entries.slice(start, start + VISIBLE);
		if (slice.length < VISIBLE && entries.length > VISIBLE) {
			const needed = VISIBLE - slice.length;
			slice.push(...entries.slice(0, needed));
		}
		return slice;
	});

	const indicatorSide = $derived(config?.pageIndicatorSide || 'left');

	function cycle() {
		if (totalPages <= 1) return;
		page = (page + 1) % totalPages;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="disk-widget" onclick={cycle} role="button" tabindex={-1}>
	{#if totalPages > 1}
		<span class="disk-page-indicator" class:left={indicatorSide === 'left'} class:right={indicatorSide === 'right'}>{page + 1}/{totalPages}</span>
	{/if}
	<div class="disk-entries">
		{#if visibleDisks().length > 0}
			{#each visibleDisks() as disk}
				<div class="disk-entry">
					<span class="disk-path">{disk.path}</span>
					<div class="disk-bar-wrap">
						<div class="disk-bar" class:low={disk.pct < 50} class:mid={disk.pct >= 50 && disk.pct < 80} class:high={disk.pct >= 80} style="width: {disk.pct}%"></div>
					</div>
					<span class="disk-pct">{disk.pct}%</span>
					<span class="disk-info">{formatBytes(disk.used)}/{formatBytes(disk.total)}</span>
				</div>
			{/each}
		{:else}
			<div class="disk-entry">
				<span class="disk-label">Disk</span>
				<span class="disk-info">No data</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.disk-widget {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		height: 100%;
		white-space: nowrap;
		cursor: pointer;
	}

	.disk-page-indicator {
		font-size: 0.6rem;
		color: var(--text-muted);
		opacity: 0.6;
		flex-shrink: 0;
		min-width: 16px;
		text-align: center;
		align-self: center;
	}

	.disk-page-indicator.left {
		order: -1;
	}

	.disk-page-indicator.right {
		order: 1;
	}

	.disk-entries {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
	}

	.disk-entry {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.disk-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.disk-path {
		font-size: 0.7rem;
		color: var(--text-muted);
		min-width: 28px;
	}

	.disk-bar-wrap {
		flex: 1;
		height: 6px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
		min-width: 24px;
	}

	.disk-bar {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s ease;
	}

	.disk-bar.low { background: var(--success); }
	.disk-bar.mid { background: var(--warning); }
	.disk-bar.high { background: var(--danger); }

	.disk-pct {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-primary);
		min-width: 30px;
		text-align: right;
	}

	.disk-info {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}
</style>