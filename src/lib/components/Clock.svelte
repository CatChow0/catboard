<script lang="ts">
	import type { ClockConfig } from '$lib/types';
	import { isEditing } from '$lib/stores/dashboard';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: ClockConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const showSeconds = $derived(config?.showSeconds ?? false);
	const format12h = $derived(config?.format12h ?? false);
	const showDate = $derived(config?.showDate ?? true);
	const dateFormat = $derived(config?.dateFormat ?? 'DD/MM');
	const showFullDate = $derived(config?.showFullDate ?? false);

	let showEditModal = $state(false);

	let now = $state(new Date());

	const cells = $derived(colSpan * rowSpan);

	$effect(() => {
		const interval = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(interval);
	});

	let timeString = $derived(() => {
		const h = now.getHours();
		const m = now.getMinutes();
		const s = now.getSeconds();
		const hh = format12h ? ((h % 12) || 12) : h;
		const mm = String(m).padStart(2, '0');
		const ss = String(s).padStart(2, '0');
		const ampm = format12h ? (h < 12 ? ' AM' : ' PM') : '';
		return showSeconds ? `${hh}:${mm}:${ss}${ampm}` : `${hh}:${mm}${ampm}`;
	});

	let dateString = $derived(() => {
		if (!showDate) return '';

		if (showFullDate) {
			const dayName = now.toLocaleString('default', { weekday: 'short' });
			const monthName = now.toLocaleString('default', { month: 'short' });
			return `${dayName}, ${monthName} ${now.getDate()}`;
		}

		const d = now.getDate();
		const m = now.getMonth() + 1;
		const dd = String(d).padStart(2, '0');
		const mm = String(m).padStart(2, '0');
		return dateFormat === 'DD/MM' ? `${dd}/${mm}` : `${mm}/${dd}`;
	});

	// Dynamic font sizes based on cell count and content length
	let timeSize = $derived(() => {
		// Base size per cell, reduced when content is longer
		const chars = timeString().length;
		const factor = chars <= 5 ? 1 : chars <= 8 ? 0.85 : 0.7;
		if (cells <= 1) return `${1.0 * factor}rem`;
		if (cells <= 2) return `${1.5 * factor}rem`;
		if (cells <= 4) return `${2.0 * factor}rem`;
		if (cells <= 6) return `${2.5 * factor}rem`;
		return `${3.0 * factor}rem`;
	});

	let dateSize = $derived(() => {
		if (cells <= 1) return '0.65rem';
		if (cells <= 2) return '0.75rem';
		if (cells <= 4) return '0.85rem';
		return '0.95rem';
	});
</script>

<div class="clock-tile">
	<div class="clock-content">
		<div class="clock-time" style="font-size: {timeSize()};">{timeString()}</div>
		{#if showDate}
			<div class="clock-date" style="font-size: {dateSize()};">{dateString()}</div>
		{/if}
	</div>
	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title="Remove clock">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); showEditModal = true; }} onpointerdown={(e) => e.stopPropagation()} title="Edit clock">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	{/if}
</div>

{#if showEditModal}
	<WidgetEditModal type="clock" {itemid} {config} onclose={() => (showEditModal = false)} />
{/if}

<style>
	.clock-tile {
		position: relative;
		height: 100%;
		background: var(--accent-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: visible;
	}

	.clock-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 12px;
		width: 100%;
		min-width: 0;
	}

	.clock-time {
		font-weight: 700;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		text-align: center;
	}

	.clock-date {
		color: var(--text-secondary);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		text-align: center;
	}

	.btn-delete {
		position: absolute;
		top: -8px;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--danger);
		color: white;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.btn-delete:hover {
		background: #c0392b;
	}

	.btn-edit {
		position: absolute;
		bottom: -8px;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--accent);
		color: white;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.clock-tile:hover .btn-delete,
	.clock-tile:hover .btn-edit {
		opacity: 1;
	}

	.btn-edit:hover {
		background: var(--accent-hover);
	}
</style>
