<script lang="ts">
	import type { DockerWidgetConfig, DockerContainerInfo } from '$lib/types';
	import { isEditing, updateDashboardItem, dockerData, getIntegrations } from '$lib/stores/dashboard';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: DockerWidgetConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	let showEditModal = $state(false);
	let closing = $state(false);
	let editEnvId = $state(config?.environmentId || '');
	let availableEnvironments = $state<{ id: string; name: string }[]>([]);

	const cells = $derived(colSpan * rowSpan);
	const showContainers = $derived(cells >= 4);

	const data = $derived($dockerData[config?.environmentId || '']);

	function statusColor(status: DockerContainerInfo['status']): string {
		if (status === 'running') return 'var(--success)';
		if (status === 'paused' || status === 'restarting') return 'var(--warning)';
		return 'var(--danger)';
	}

	function statusLabel(status: DockerContainerInfo['status']): string {
		if (status === 'running') return 'running';
		if (status === 'paused') return 'paused';
		if (status === 'restarting') return 'restarting';
		if (status === 'dead') return 'dead';
		return 'stopped';
	}

	async function openEditModal() {
		editEnvId = config?.environmentId || '';
		closing = false;
		try {
			const integrations = await getIntegrations();
			availableEnvironments = integrations.docker?.environments || [];
		} catch {
			availableEnvironments = [];
		}
		showEditModal = true;
	}

	function closeModal() {
		closing = true;
		setTimeout(() => { showEditModal = false; closing = false; }, 180);
	}

	async function handleSaveEdit() {
		showEditModal = false;
		closing = false;
		await updateDashboardItem(itemid, { config: { environmentId: editEnvId.trim() } } as any);
	}
</script>

<div class="docker-tile">
	<div class="docker-inner">
		{#if !config?.environmentId}
			<div class="docker-placeholder">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M2 15h4v4H2zM9 15h4v4H9zM16 15h4v4h-4zM2 9h4v4H2zM9 9h4v4H9zM16 9h4v4h-4zM9 3h4v4H9z" />
				</svg>
				<span>No environment configured</span>
			</div>
		{:else if !data}
			<div class="docker-loading">...</div>
		{:else}
			<div class="docker-content">
				<div class="docker-title">{data.name}</div>
				<div class="docker-summary">
					<span class="docker-badge active">{data.runningCount} running</span>
					<span class="docker-badge inactive">{data.stoppedCount} stopped</span>
				</div>
				{#if showContainers && data.containers.length > 0}
					<div class="docker-containers">
						{#each data.containers as container}
							<div class="docker-container">
								<span class="docker-container-dot" style="background: {statusColor(container.status)};"></span>
								<span class="docker-container-name">{container.name}</span>
								<span class="docker-container-status" style="color: {statusColor(container.status)}">{statusLabel(container.status)}</span>
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
				<h2>Edit Docker Widget</h2>
				<button class="btn-close" onclick={closeModal}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="modal-body">
				<div class="field">
					<label>Environment</label>
					{#if availableEnvironments.length > 0}
						<select bind:value={editEnvId}>
							<option value="">Select environment</option>
							{#each availableEnvironments as env}
								<option value={env.id}>{env.name}</option>
							{/each}
						</select>
					{:else}
						<p class="hint">No Docker environments configured. Add one in Settings &gt; Integrations.</p>
					{/if}
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
	.docker-tile {
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

	.docker-inner {
		height: 100%;
		width: 100%;
		overflow: hidden;
		border-radius: inherit;
	}

	.docker-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 0.75rem;
		padding: 12px;
	}

	.docker-loading {
		font-size: 1.2rem;
		color: var(--text-muted);
	}

	.docker-content {
		display: flex;
		flex-direction: column;
		padding: 12px;
		width: 100%;
		min-width: 0;
		max-height: 100%;
		overflow-y: auto;
		gap: 8px;
	}

	.docker-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.docker-summary {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.docker-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
		white-space: nowrap;
	}

	.docker-badge.active {
		background: color-mix(in srgb, var(--success) 20%, transparent);
		color: var(--success);
	}

	.docker-badge.inactive {
		background: color-mix(in srgb, var(--danger) 20%, transparent);
		color: var(--danger);
	}

	.docker-containers {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.docker-container {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
	}

	.docker-container-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.docker-container-name {
		flex: 1;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.docker-container-status {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
		font-size: 0.7rem;
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

	.docker-tile:hover .btn-delete,
	.docker-tile:hover .btn-edit {
		opacity: 1;
	}

	.hint {
		font-size: 0.85rem;
		color: var(--text-secondary);
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

	.field select {
		width: 100%;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.field select:focus {
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
