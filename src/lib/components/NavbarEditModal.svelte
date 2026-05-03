<script lang="ts">
	import type { NavbarItem } from '$lib/types';
	import { updateNavbarItem, getIntegrations } from '$lib/stores/dashboard';

	let { item, onclose }: { item: NavbarItem; onclose: () => void } = $props();

	let closing = $state(false);
	let tempSensor = $state(item.type === 'navbar-cpu' ? (item.config?.tempSensor || '') : '');
	let diskPaths = $state<string[]>(item.type === 'navbar-disk' ? (item.config?.disks || []) : []);
	let pageIndicatorSide = $state<'left' | 'right'>(item.type === 'navbar-disk' ? (item.config?.pageIndicatorSide || 'left') : 'left');
	let placeholder = $state(item.type === 'navbar-search' ? (item.placeholder || '') : '');
	let ukSlug = $state(item.type === 'navbar-uptime-kuma-status-page' ? (item.config?.slug || '') : '');
	let dockerEnvId = $state(item.type === 'navbar-docker' ? (item.config?.environmentId || '') : '');
	let dockerEnvironments = $state<{ id: string; name: string }[]>([]);
	let colSpan = $state(item.colSpan);
	let availableDisks = $state<string[]>([]);
	let tempSensors = $state<string[]>([]);
	let tempSensorsLoading = $state(false);
	let tempSensorsDetected = $state(false);
	let disksLoading = $state(false);
	let disksDetected = $state(false);

	async function loadTempSensors() {
		tempSensorsLoading = true;
		try {
			const res = await fetch('/api/temp-sensors');
			const data = await res.json();
			tempSensors = data.sensors || [];
			tempSensorsDetected = true;
		} catch {
			tempSensors = [];
			tempSensorsDetected = true;
		} finally {
			tempSensorsLoading = false;
		}
	}

	async function loadAvailableDisks() {
		disksLoading = true;
		try {
			const res = await fetch('/api/disks');
			const data = await res.json();
			availableDisks = data.disks || [];
			disksDetected = true;
		} catch {
			availableDisks = [];
			disksDetected = true;
		} finally {
			disksLoading = false;
		}
	}

	function toggleDiskPath(path: string) {
		if (diskPaths.includes(path)) {
			diskPaths = diskPaths.filter(p => p !== path);
		} else {
			diskPaths = [...diskPaths, path];
		}
	}

	async function handleSave() {
		const updates: Partial<NavbarItem> & { config?: Record<string, unknown>; placeholder?: string } = { colSpan };

		if (item.type === 'navbar-cpu') {
			updates.config = { tempSensor: tempSensor || undefined };
		} else if (item.type === 'navbar-disk') {
			updates.config = { disks: diskPaths, pageIndicatorSide };
		} else if (item.type === 'navbar-uptime-kuma-status-page') {
			updates.config = { slug: ukSlug };
		} else if (item.type === 'navbar-search') {
			updates.placeholder = placeholder;
		}

		await updateNavbarItem(item.id, updates);
		close();
	}

	function close() {
		closing = true;
		setTimeout(() => onclose(), 180);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="modal-overlay" class:closing role="dialog" aria-modal="true" tabindex="-1" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}>
	<div class="modal" onclick={(e) => e.stopPropagation()}>
		<div class="modal-header">
			<h2>Edit {item.type.replace('navbar-', '').charAt(0).toUpperCase() + item.type.replace('navbar-', '').slice(1)} Widget</h2>
			<button class="btn-close" onclick={close}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="modal-body">
			{#if item.type === 'navbar-cpu'}
				<div class="field">
					<label>Temperature sensor</label>
					{#if tempSensorsLoading}
						<div class="detect-status">Detecting...</div>
					{:else if tempSensorsDetected && tempSensors.length > 0}
						<select bind:value={tempSensor}>
							<option value="">Auto (Main)</option>
							{#each tempSensors as sensor}
								<option value={sensor}>{sensor}</option>
							{/each}
						</select>
					{:else if tempSensorsDetected && tempSensors.length === 0}
						<div class="detect-status no-sensors">No temperature sensors found on this system</div>
					{:else}
						<button class="btn-detect" onclick={loadTempSensors}>Detect sensors</button>
					{/if}
				</div>
			{:else if item.type === 'navbar-disk'}
				<div class="field">
					<label>Select disks to monitor</label>
					{#if disksLoading}
						<div class="detect-status">Detecting...</div>
					{:else if disksDetected && availableDisks.length > 0}
						<div class="disk-list">
							{#each availableDisks as path}
								<label class="disk-check">
									<input type="checkbox" checked={diskPaths.includes(path)} onchange={() => toggleDiskPath(path)} />
									<span>{path}</span>
								</label>
							{/each}
						</div>
					{:else if disksDetected && availableDisks.length === 0}
						<div class="detect-status no-sensors">No disks found</div>
					{:else}
						<button class="btn-detect" onclick={loadAvailableDisks}>Detect disks</button>
					{/if}
				</div>
				<div class="field">
					<label>Page indicator side</label>
					<div class="side-toggle">
						<button class="side-btn" class:active={pageIndicatorSide === 'left'} onclick={() => (pageIndicatorSide = 'left')}>Left</button>
						<button class="side-btn" class:active={pageIndicatorSide === 'right'} onclick={() => (pageIndicatorSide = 'right')}>Right</button>
					</div>
				</div>
			{:else if item.type === 'navbar-search'}
				<div class="field">
					<label>Placeholder text</label>
					<input type="text" bind:value={placeholder} placeholder="Search services..." />
				</div>
			{:else if item.type === 'navbar-title'}
				<p class="hint">The title widget displays the dashboard title from settings. No additional configuration needed.</p>
			{:else if item.type === 'navbar-ram'}
				<p class="hint">The RAM widget automatically shows RAM and swap usage. No additional configuration needed.</p>
			{:else if item.type === 'navbar-uptime-kuma-status-page'}
				<div class="field">
					<label>Status page slug</label>
					<input type="text" bind:value={ukSlug} placeholder="e.g. default" />
				</div>
			{/if}

			<div class="field">
				<label>Width (columns)</label>
				<input type="number" bind:value={colSpan} min="1" max="12" />
			</div>
		</div>

		<div class="modal-actions">
			<button class="btn-cancel" onclick={close}>Cancel</button>
			<button class="btn-save" onclick={handleSave}>Save</button>
		</div>
	</div>
</div>

<style>
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

	.field input, .field select {
		width: 100%;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.field input:focus, .field select:focus {
		border-color: var(--accent);
	}

	.hint {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}

	.side-toggle {
		display: flex;
		gap: 4px;
	}

	.side-btn {
		flex: 1;
		padding: 6px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		transition: all var(--transition);
	}

	.side-btn.active {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.disk-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 4px;
	}

	.disk-check {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8rem;
		color: var(--text-primary);
		cursor: pointer;
		padding: 4px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		transition: all var(--transition);
	}

	.disk-check:hover {
		border-color: var(--accent);
	}

	.disk-check input[type="checkbox"] {
		accent-color: var(--accent);
	}

	.btn-detect {
		padding: 6px 12px;
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		transition: all var(--transition);
	}

	.btn-detect:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.detect-status {
		font-size: 0.8rem;
		color: var(--text-muted);
		padding: 6px 0;
	}

	.detect-status.no-sensors {
		color: var(--text-secondary);
		font-style: italic;
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