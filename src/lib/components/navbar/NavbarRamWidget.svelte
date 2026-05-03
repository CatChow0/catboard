<script lang="ts">
	import { systemStats } from '$lib/stores/dashboard';

	let { colSpan = 2 }: { colSpan?: number } = $props();

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb < 1) return `${Math.round(bytes / (1024 * 1024))} MB`;
		return `${gb.toFixed(1)} GB`;
	}

	const usedPct = $derived($systemStats.ram.total > 0 ? Math.round(($systemStats.ram.used / $systemStats.ram.total) * 100) : 0);
	const swapPct = $derived($systemStats.ram.swapTotal > 0 ? Math.round(($systemStats.ram.swapUsed / $systemStats.ram.swapTotal) * 100) : 0);
	const hasSwap = $derived($systemStats.ram.swapTotal > 0);
</script>

<div class="ram-widget">
	<div class="ram-bars">
		<div class="ram-bar-row">
			<span class="ram-label">RAM</span>
			<div class="ram-bar-wrap">
				<div class="ram-bar" class:low={usedPct < 50} class:mid={usedPct >= 50 && usedPct < 80} class:high={usedPct >= 80} style="width: {usedPct}%"></div>
			</div>
			<span class="ram-pct">{usedPct}%</span>
		</div>
		{#if hasSwap}
			<div class="ram-bar-row">
				<span class="swap-label">SWAP</span>
				<div class="ram-bar-wrap">
					<div class="swap-bar" style="width: {swapPct}%"></div>
				</div>
				<span class="swap-pct">{swapPct}%</span>
			</div>
		{/if}
	</div>
	<span class="ram-info">{formatBytes($systemStats.ram.used)}/{formatBytes($systemStats.ram.total)}</span>
</div>

<style>
	.ram-widget {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 8px;
		height: 100%;
		white-space: nowrap;
	}

	.ram-bars {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 40px;
	}

	.ram-bar-row {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.ram-label, .swap-label {
		font-size: 0.65rem;
		font-weight: 700;
		min-width: 28px;
		flex-shrink: 0;
	}

	.ram-label {
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.swap-label {
		color: #7c6ff7;
		text-transform: uppercase;
	}

	.ram-bar-wrap {
		flex: 1;
		height: 6px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
		min-width: 24px;
	}

	.ram-bar {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s ease;
	}

	.ram-bar.low { background: var(--success); }
	.ram-bar.mid { background: var(--warning); }
	.ram-bar.high { background: var(--danger); }

	.swap-bar {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s ease;
		background: #7c6ff7;
	}

	.ram-pct {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-primary);
		min-width: 28px;
		text-align: right;
	}

	.swap-pct {
		font-size: 0.7rem;
		font-weight: 600;
		color: #7c6ff7;
		min-width: 28px;
		text-align: right;
	}

	.ram-info {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-primary);
		min-width: 80px;
		text-align: right;
	}
</style>