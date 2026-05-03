<script lang="ts">
	import type { Service } from '$lib/stores/dashboard';
	import IconPicker from './IconPicker.svelte';

	let { service, onsave, onclose }: {
		service?: Service | null;
		onsave: (service: Partial<Service>) => void;
		onclose: () => void;
	} = $props();

	let closing = $state(false);
	let name = $state('');
	let url = $state('');
	let icon = $state('');
	let description = $state('');
	let statusCheckEnabled = $state(true);

	$effect(() => {
		name = service?.name || '';
		url = service?.url || '';
		icon = service?.icon || '';
		description = service?.description || '';
		statusCheckEnabled = service?.statusCheck?.enabled ?? true;
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		onsave({
			name,
			url,
			icon,
			description,
			statusCheck: { enabled: statusCheckEnabled, method: 'HEAD' }
		});
	}

	function close() {
		closing = true;
		setTimeout(() => onclose(), 180);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="modal-overlay" class:closing role="dialog" aria-modal="true" tabindex="-1" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<form class="modal" class:closing onclick={(e) => e.stopPropagation()} onsubmit={handleSubmit}>
		<h2>{service ? 'Edit Service' : 'Add Service'}</h2>
		<div class="form-group">
			<label for="name">Name</label>
			<input id="name" type="text" bind:value={name} required placeholder="Proxmox" />
		</div>
		<div class="form-group">
			<label for="url">URL</label>
			<input id="url" type="url" bind:value={url} required placeholder="https://proxmox.home.local" />
		</div>
		<div class="form-group">
			<label>Icon</label>
			<IconPicker value={icon} onchange={(v) => (icon = v)} />
		</div>
		<div class="form-group">
			<label for="description">Description</label>
			<input id="description" type="text" bind:value={description} placeholder="Hypervisor" />
		</div>
		<div class="form-group checkbox">
			<label>
				<input type="checkbox" bind:checked={statusCheckEnabled} />
				Enable status check
			</label>
		</div>
		<div class="form-actions">
			<button type="button" class="btn-cancel" onclick={close}>Cancel</button>
			<button type="submit" class="btn-save">{service ? 'Save' : 'Add'}</button>
		</div>
	</form>
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
		padding: 28px;
		max-width: 460px;
		width: 90%;
		animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.modal.closing {
		animation: slideDown 0.18s ease forwards;
	}

	.modal h2 {
		margin-bottom: 20px;
		font-size: 1.2rem;
	}

	.form-group {
		margin-bottom: 14px;
	}

	.form-group label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 4px;
	}

	.form-group input[type='text'],
	.form-group input[type='url'] {
		width: 100%;
		padding: 10px 12px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		transition: border-color var(--transition);
	}

	.form-group input:focus {
		border-color: var(--accent);
	}

	.checkbox label {
		display: flex !important;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.checkbox input[type='checkbox'] {
		width: 16px;
		height: 16px;
		accent-color: var(--accent);
	}

	.form-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 20px;
	}

	.btn-cancel {
		padding: 10px 20px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		color: var(--text-secondary);
	}

	.btn-cancel:hover {
		background: var(--bg-card-hover);
	}

	.btn-save {
		padding: 10px 20px;
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

	@keyframes slideDown {
		from { opacity: 1; transform: translateY(0); }
		to { opacity: 0; transform: translateY(20px); }
	}
</style>