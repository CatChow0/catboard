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
		font-size: calc(0.75rem * var(--nb-text, 1));
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.cpu-bar-wrap {
		flex: 1;
		height: calc(6px * var(--nb-icon, 1));
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
		min-width: calc(40px * var(--nb-text, 1));
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
		font-size: calc(0.8rem * var(--nb-text, 1));
		font-weight: 600;
		color: var(--text-primary);
		min-width: calc(36px * var(--nb-text, 1));
		text-align: right;
	}

	.cpu-temp {
		font-size: calc(0.75rem * var(--nb-text, 1));
		color: var(--text-secondary);
		min-width: calc(36px * var(--nb-text, 1));
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