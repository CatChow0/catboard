<script lang="ts">
	import { systemStats } from '$lib/stores/dashboard';

	let { colSpan = 2, config }: { colSpan?: number; config?: { tempSensor?: string } } = $props();

	const hasTemp = $derived($systemStats.cpu.temperature !== null && $systemStats.cpu.temperature !== undefined);
</script>

<div class="cpu-widget">
	<div class="cpu-label">CPU</div>
	<div class="cpu-bar-wrap">
		<div class="cpu-bar" class:low={$systemStats.cpu.usage < 50} class:mid={$systemStats.cpu.usage >= 50 && $systemStats.cpu.usage < 80} class:high={$systemStats.cpu.usage >= 80} style="width: {$systemStats.cpu.usage}%"></div>
	</div>
	<span class="cpu-pct">{$systemStats.cpu.usage}%</span>
	<span class="cpu-temp" class:no-data={!hasTemp} class:warn={hasTemp && $systemStats.cpu.temperature! >= 70} class:danger={hasTemp && $systemStats.cpu.temperature! >= 85}>
		{hasTemp ? `${$systemStats.cpu.temperature}°C` : '---'}
	</span>
</div>

<style>
	.cpu-widget {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 8px;
		height: 100%;
		white-space: nowrap;
	}

	.cpu-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.cpu-bar-wrap {
		flex: 1;
		height: 6px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
		min-width: 40px;
	}

	.cpu-bar {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s ease;
	}

	.cpu-bar.low { background: var(--success); }
	.cpu-bar.mid { background: var(--warning); }
	.cpu-bar.high { background: var(--danger); }

	.cpu-pct {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-primary);
		min-width: 36px;
		text-align: right;
	}

	.cpu-temp {
		font-size: 0.75rem;
		color: var(--text-secondary);
		min-width: 36px;
	}

	.cpu-temp.no-data {
		opacity: 0.4;
	}

	.cpu-temp.warn {
		color: var(--warning);
	}

	.cpu-temp.danger {
		color: var(--danger);
	}
</style>