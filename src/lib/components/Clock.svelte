<script lang="ts">
	import type { ClockConfig } from '$lib/types';
	import { isEditing } from '$lib/stores/dashboard';
	import { updateDashboardItem } from '$lib/stores/dashboard';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: ClockConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	let showSeconds = $state(config?.showSeconds ?? false);
	let format12h = $state(config?.format12h ?? false);
	let showDate = $state(config?.showDate ?? true);
	let dateFormat = $state<'DD/MM' | 'MM/DD'>(config?.dateFormat ?? 'DD/MM');
	let showFullDate = $state(config?.showFullDate ?? false);

	let showEditModal = $state(false);
	let closing = $state(false);

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

	function openEditModal() {
		showSeconds = config?.showSeconds ?? false;
		format12h = config?.format12h ?? false;
		showDate = config?.showDate ?? true;
		dateFormat = config?.dateFormat ?? 'DD/MM';
		showFullDate = config?.showFullDate ?? false;
		closing = false;
		showEditModal = true;
	}

	function closeModal() {
		closing = true;
		setTimeout(() => { showEditModal = false; closing = false; }, 180);
	}

	async function handleSaveEdit() {
		showEditModal = false;
		closing = false;
		await updateDashboardItem(itemid, {
			config: { showSeconds, format12h, showDate, dateFormat, showFullDate }
		});
	}

	function toggleDateFormat() {
		dateFormat = dateFormat === 'DD/MM' ? 'MM/DD' : 'DD/MM';
	}
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
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); openEditModal(); }} onpointerdown={(e) => e.stopPropagation()} title="Edit clock">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	{/if}
</div>

{#if showEditModal}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="modal-overlay" class:closing role="dialog" aria-modal="true" tabindex="-1" onclick={closeModal} onpointerdown={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && closeModal()}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Edit Clock</h2>
				<button class="btn-close" onclick={closeModal}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="modal-body">
				<label class="toggle-switch">
					<input type="checkbox" bind:checked={showSeconds} />
					<span class="toggle-slider"></span>
					<span class="toggle-label">Show seconds</span>
				</label>
				<label class="toggle-switch">
					<input type="checkbox" bind:checked={format12h} />
					<span class="toggle-slider"></span>
					<span class="toggle-label">{format12h ? '12h (PM)' : '24h'}</span>
				</label>
				<label class="toggle-switch">
					<input type="checkbox" bind:checked={showDate} />
					<span class="toggle-slider"></span>
					<span class="toggle-label">Show date</span>
				</label>
				{#if showDate}
					<label class="toggle-switch indented">
						<button class="format-toggle" onclick={toggleDateFormat}>
							{dateFormat}
						</button>
						<span class="toggle-label">Date format</span>
					</label>
					<label class="toggle-switch indented">
						<input type="checkbox" bind:checked={showFullDate} />
						<span class="toggle-slider"></span>
						<span class="toggle-label">Full date</span>
					</label>
				{/if}
			</div>

			<div class="modal-actions">
				<button class="btn-cancel" onclick={closeModal}>Cancel</button>
				<button class="btn-save" onclick={handleSaveEdit}>Save</button>
			</div>
		</div>
	</div>
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

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.15s ease;
	}

	.modal-overlay.closing {
		animation: fadeOut 0.18s ease forwards;
	}

	.modal {
		background: var(--bg-modal);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		max-width: 420px;
		width: 90%;
		animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.modal-header h2 {
		font-size: 1rem;
	}

	.btn-close {
		padding: 4px;
		border-radius: 4px;
		display: flex;
	}

	.btn-close:hover {
		background: var(--bg-card-hover);
	}

	.modal-body {
		padding: 16px 20px;
	}

	.toggle-switch {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		margin-bottom: 10px;
		position: relative;
	}

	.toggle-switch.indented {
		padding-left: 28px;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
		position: absolute;
	}

	.toggle-slider {
		width: 36px;
		height: 20px;
		background: var(--border);
		border-radius: 20px;
		position: relative;
		transition: background var(--transition);
		flex-shrink: 0;
	}

	.toggle-slider::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: white;
		border-radius: 50%;
		transition: transform var(--transition);
	}

	.toggle-switch input:checked + .toggle-slider {
		background: var(--accent);
	}

	.toggle-switch input:checked + .toggle-slider::after {
		transform: translateX(16px);
	}

	.toggle-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.format-toggle {
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.8rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		transition: all var(--transition);
		min-width: 48px;
		text-align: center;
	}

	.format-toggle:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
	}

	.btn-cancel {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		color: var(--text-secondary);
	}

	.btn-save {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: white;
		font-weight: 500;
	}

	.btn-save:hover {
		background: var(--accent-hover);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes fadeOut {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>