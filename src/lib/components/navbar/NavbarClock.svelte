<script lang="ts">
	// Navbar time and date. Same options and formatting as the standard Clock widget.
	import type { ClockConfig } from '$lib/types';

	let { colSpan = 2, config }: { colSpan?: number; config?: ClockConfig } = $props();

	const showSeconds = $derived(config?.showSeconds ?? false);
	const format12h = $derived(config?.format12h ?? false);
	const showDate = $derived(config?.showDate ?? true);
	const dateFormat = $derived(config?.dateFormat ?? 'DD/MM');
	const showFullDate = $derived(config?.showFullDate ?? false);
	// One column is too narrow for time and date side by side.
	const stacked = $derived(colSpan <= 1);

	let now = $state(new Date());

	$effect(() => {
		const interval = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(interval);
	});

	const time = $derived.by(() => {
		const h = now.getHours();
		const hh = format12h ? h % 12 || 12 : h;
		const mm = String(now.getMinutes()).padStart(2, '0');
		const ss = String(now.getSeconds()).padStart(2, '0');
		const ampm = format12h ? (h < 12 ? ' AM' : ' PM') : '';
		return showSeconds ? `${hh}:${mm}:${ss}${ampm}` : `${hh}:${mm}${ampm}`;
	});

	const date = $derived.by(() => {
		if (!showDate) return '';
		if (showFullDate) {
			const day = now.toLocaleString('default', { weekday: 'short' });
			const month = now.toLocaleString('default', { month: 'short' });
			return `${day}, ${month} ${now.getDate()}`;
		}
		const dd = String(now.getDate()).padStart(2, '0');
		const mo = String(now.getMonth() + 1).padStart(2, '0');
		return dateFormat === 'DD/MM' ? `${dd}/${mo}` : `${mo}/${dd}`;
	});
</script>

<div class="nb-clock" class:stacked title={now.toLocaleString()}>
	<span class="nb-time">{time}</span>
	{#if date}
		<span class="nb-date">{date}</span>
	{/if}
</div>

<style>
	.nb-clock {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 0 8px;
		height: 100%;
		white-space: nowrap;
		align-content: center;
		overflow: hidden;
	}

	.nb-clock:not(.stacked) {
		align-items: center;
	}

	.nb-clock.stacked {
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		gap: 0;
		line-height: 1.15;
	}

	.nb-time {
		font-size: calc(0.85rem * var(--nb-text, 1));
		font-weight: 600;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.nb-date {
		font-size: calc(0.75rem * var(--nb-text, 1));
		color: var(--text-secondary);
	}

	.stacked .nb-date {
		font-size: calc(0.68rem * var(--nb-text, 1));
	}
</style>
