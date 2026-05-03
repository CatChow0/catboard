<script lang="ts">
	import type { UptimeKumaStatusPageConfig } from '$lib/types';
	import { isEditing, updateDashboardItem, uptimeKumaData } from '$lib/stores/dashboard';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: UptimeKumaStatusPageConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	let showEditModal = $state(false);
	let closing = $state(false);
	let editSlug = $state(config?.slug || '');

	const cells = $derived(colSpan * rowSpan);
	const showMonitors = $derived(cells >= 6);

	const data = $derived($uptimeKumaData[config?.slug || '']);

	function uptimeColor(pct: number): string {
		if (pct >= 99) return 'var(--success)';
		if (pct >= 95) return 'var(--warning)';
		return 'var(--danger)';
	}

	function openEditModal() {
		editSlug = config?.slug || '';
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
		await updateDashboardItem(itemid, { config: { slug: editSlug.trim() } } as any);
	}
</script>

<div class="uk-tile">
	<div class="uk-inner">
		{#if !config?.slug}
			<div class="uk-placeholder">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<circle cx="12" cy="12" r="10" />
					<path d="M12 6v6l4 2" />
				</svg>
				<span>No status page configured</span>
			</div>
		{:else if !data}
			<div class="uk-loading">...</div>
		{:else}
			<div class="uk-content">
				<div class="uk-title">{data.title}</div>
				<div class="uk-summary">
					<span class="uk-badge active">{data.activeCount} up</span>
					<span class="uk-badge inactive">{data.inactiveCount} down</span>
					<span class="uk-uptime" style="color: {uptimeColor(data.overallUptime)}">{data.overallUptime}%</span>
				</div>
				{#if cells >= 2}
					<div class="uk-bar-track">
						<div class="uk-bar-fill" style="width: {data.overallUptime}%; background: {uptimeColor(data.overallUptime)};"></div>
					</div>
				{/if}
				{#if showMonitors && data.monitors.length > 0}
					<div class="uk-monitors">
						{#each data.monitors as mon}
							<div class="uk-monitor">
								<span class="uk-monitor-dot" class:up={mon.status === 1} class:down={mon.status !== 1}></span>
								<span class="uk-monitor-name">{mon.name}</span>
								<span class="uk-monitor-uptime" style="color: {uptimeColor(mon.uptime24h)}">{mon.uptime24h}%</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title="Remove widget">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); openEditModal(); }} onpointerdown={(e) => e.stopPropagation()} title="Edit widget">
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
				<h2>Edit Uptime Kuma</h2>
				<button class="btn-close" onclick={closeModal}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="modal-body">
				<div class="field">
					<label>Status page slug</label>
					<input type="text" bind:value={editSlug} placeholder="e.g. default" />
				</div>
			</div>

			<div class="modal-actions">
				<button class="btn-cancel" onclick={closeModal}>Cancel</button>
				<button class="btn-save" onclick={handleSaveEdit}>Save</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.uk-tile {
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

	.uk-inner {
		height: 100%;
		width: 100%;
		overflow: hidden;
		border-radius: inherit;
	}

	.uk-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 0.75rem;
		padding: 12px;
	}

	.uk-loading {
		font-size: 1.2rem;
		color: var(--text-muted);
	}

	.uk-content {
		display: flex;
		flex-direction: column;
		padding: 12px;
		width: 100%;
		min-width: 0;
		gap: 8px;
		height: 100%;
	}

	.uk-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.uk-summary {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.uk-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
		white-space: nowrap;
	}

	.uk-badge.active {
		background: color-mix(in srgb, var(--success) 20%, transparent);
		color: var(--success);
	}

	.uk-badge.inactive {
		background: color-mix(in srgb, var(--danger) 20%, transparent);
		color: var(--danger);
	}

	.uk-uptime {
		font-size: 0.8rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.uk-bar-track {
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.uk-bar-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.uk-monitors {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.uk-monitor {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
	}

	.uk-monitor-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.uk-monitor-dot.up {
		background: var(--success);
	}

	.uk-monitor-dot.down {
		background: var(--danger);
	}

	.uk-monitor-name {
		flex: 1;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.uk-monitor-uptime {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
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

	.btn-edit:hover {
		background: var(--accent-hover);
	}

	.uk-tile:hover .btn-delete,
	.uk-tile:hover .btn-edit {
		opacity: 1;
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

	.field {
		margin-bottom: 12px;
	}

	.field label {
		display: block;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: 4px;
	}

	.field input {
		width: 100%;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.field input:focus {
		border-color: var(--accent);
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
