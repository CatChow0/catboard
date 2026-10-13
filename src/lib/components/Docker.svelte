<script lang="ts">
	import type { DockerWidgetConfig } from '$lib/types';
	import { isEditing, updateDashboardItem, dockerData, getIntegrations } from '$lib/stores/dashboard';
	import DockerDetails from './details/DockerDetails.svelte';
	import DockerLogo from './icons/DockerLogo.svelte';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: DockerWidgetConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	let showEditModal = $state(false);
	let closing = $state(false);
	let editEnvId = $state('');
	let editShowCpu = $state(false);
	let editShowRam = $state(false);
	let availableEnvironments = $state<{ id: string; name: string }[]>([]);

	const cells = $derived(colSpan * rowSpan);
	const showContainers = $derived(cells >= 4);

	const data = $derived($dockerData[config?.environmentId || '']);

	async function openEditModal() {
		editEnvId = config?.environmentId || '';
		editShowCpu = config?.showCpu ?? false;
		editShowRam = config?.showRam ?? false;
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
		const next: DockerWidgetConfig = { environmentId: editEnvId.trim(), showCpu: editShowCpu || undefined, showRam: editShowRam || undefined };
		await updateDashboardItem(itemid, { config: next } as any);
	}
</script>

<div class="docker-tile">
	<div class="docker-inner">
		{#if !config?.environmentId}
			<div class="docker-placeholder">
				<DockerLogo size={24} />
				<span>No environment configured</span>
			</div>
		{:else if !data}
			<div class="docker-loading">...</div>
		{:else}
			<DockerDetails {data} showList={showContainers} showCpu={config.showCpu} showRam={config.showRam} />
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
		<div class="modal" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key !== 'Escape' && e.stopPropagation()}>
			<div class="modal-header">
				<h2>Edit Docker Widget</h2>
				<button class="btn-close" onclick={closeModal} aria-label="Close">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="modal-body">
				<div class="field">
					<label for="docker-env-{itemid}">Environment</label>
					{#if availableEnvironments.length > 0}
						<select id="docker-env-{itemid}" bind:value={editEnvId}>
							<option value="">Select environment</option>
							{#each availableEnvironments as env (env.id)}
								<option value={env.id}>{env.name}</option>
							{/each}
						</select>
					{:else}
						<p class="hint">No Docker environments configured. Add one in Add &gt; Integrations &gt; Connections.</p>
					{/if}
				</div>
				<p class="group-title">Per-container usage</p>
				<label class="toggle-switch">
					<input type="checkbox" bind:checked={editShowCpu} />
					<span class="toggle-slider"></span>
					<span class="toggle-label">Show CPU</span>
				</label>
				<label class="toggle-switch">
					<input type="checkbox" bind:checked={editShowRam} />
					<span class="toggle-slider"></span>
					<span class="toggle-label">Show RAM</span>
				</label>
				<p class="hint small">Refreshed every 10 seconds. CPU is averaged between two readings (100% = one core).</p>
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

	.hint.small {
		margin: 4px 0 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.group-title {
		margin: 4px 0 8px;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	.toggle-switch {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		margin-bottom: 10px;
		position: relative;
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

	.toggle-switch input:focus-visible + .toggle-slider {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.toggle-label {
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
