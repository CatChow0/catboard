<script lang="ts">
	// Add > Services: registered services (search, sort, register / edit /
	// delete) and adding one to the dashboard shown. Styles: add.css.
	import type { Service } from '$lib/stores/dashboard';
	import { services, registerService, updateService, deleteService, addServiceToDashboard, activeGrid } from '$lib/stores/dashboard';
	import IconPicker from '../IconPicker.svelte';
	import { iconSrc } from '$lib/utils/icons';

	type ServiceSort = 'oldest' | 'newest' | 'name-asc' | 'name-desc';
	const SORT_KEY = 'catboard:services-sort';

	let showRegisterForm = $state(false);
	let newServiceName = $state('');
	let newServiceUrl = $state('');
	let newServiceIcon = $state('');
	let newServiceDesc = $state('');
	let editingServiceId = $state<string | null>(null);
	let addedServiceIds = $state<Set<string>>(new Set());
	let serviceQuery = $state('');
	let serviceSort = $state<ServiceSort>(readSort());

	function readSort(): ServiceSort {
		try {
			const v = localStorage.getItem(SORT_KEY);
			if (v === 'oldest' || v === 'newest' || v === 'name-asc' || v === 'name-desc') return v;
		} catch {
			// storage unavailable
		}
		return 'oldest';
	}

	$effect(() => {
		try {
			localStorage.setItem(SORT_KEY, serviceSort);
		} catch {
			// storage unavailable: the choice lasts for this popup only
		}
	});

	// services.json keeps registration order: oldest first.
	const shownServices = $derived.by(() => {
		const q = serviceQuery.trim().toLowerCase();
		const list = q ? $services.filter((s) => `${s.name} ${s.url} ${s.description}`.toLowerCase().includes(q)) : [...$services];
		if (serviceSort === 'newest') list.reverse();
		else if (serviceSort === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
		else if (serviceSort === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
		return list;
	});

	function flashAdded(id: string) {
		addedServiceIds = new Set([...addedServiceIds, id]);
		setTimeout(() => {
			addedServiceIds.delete(id);
			addedServiceIds = new Set(addedServiceIds);
		}, 1500);
	}

	async function handleRegister(e: Event) {
		e.preventDefault();
		const data = { name: newServiceName, url: newServiceUrl, icon: newServiceIcon, description: newServiceDesc };
		const editing = editingServiceId;
		resetForm();
		if (editing) {
			await updateService(editing, data);
			return;
		}
		const svc = await registerService({ ...data, statusCheck: { enabled: true, method: 'HEAD' } });
		await addServiceToDashboard(svc.id, $activeGrid.columns);
		flashAdded(svc.id);
	}

	async function handleAddExisting(serviceId: string) {
		await addServiceToDashboard(serviceId, $activeGrid.columns);
		flashAdded(serviceId);
	}

	function resetForm() {
		newServiceName = '';
		newServiceUrl = '';
		newServiceIcon = '';
		newServiceDesc = '';
		showRegisterForm = false;
		editingServiceId = null;
	}

	function handleEditService(service: Service) {
		newServiceName = service.name;
		newServiceUrl = service.url;
		newServiceIcon = service.icon;
		newServiceDesc = service.description;
		editingServiceId = service.id;
		showRegisterForm = true;
	}

	/** Server icon failed: try the bundled icon for a legacy name, then show the initial. */
	function handleCardIconError(e: Event, service: Service) {
		const img = e.currentTarget as HTMLImageElement;
		const legacy = service.icon && !service.icon.includes(':') ? service.icon : '';
		if (legacy && !img.src.includes('/icons/')) {
			img.src = `/icons/${legacy}.svg`;
		} else {
			img.style.display = 'none';
			const fallback = img.parentElement?.querySelector('.card-icon-fallback') as HTMLElement | null;
			if (fallback) fallback.style.display = 'flex';
		}
	}
</script>

<div class="tab-content cb-form">
	{#if showRegisterForm}
		<form class="register-form" onsubmit={handleRegister}>
			<h3>{editingServiceId ? 'Edit service' : 'Register a service'}</h3>
			<div class="field-row">
				<label class="field">
					<span>Name</span>
					<input type="text" bind:value={newServiceName} required placeholder="Proxmox" />
				</label>
				<label class="field">
					<span>URL</span>
					<input type="url" bind:value={newServiceUrl} required placeholder="https://proxmox.home.local" />
				</label>
			</div>
			<div class="field">
				<span>Icon</span>
				<IconPicker value={newServiceIcon} onchange={(v) => (newServiceIcon = v)} name={newServiceName} url={newServiceUrl} />
			</div>
			<label class="field">
				<span>Description</span>
				<input type="text" bind:value={newServiceDesc} placeholder="Hypervisor" />
			</label>
			<div class="form-actions">
				<button type="button" class="btn-cancel" onclick={resetForm}>Cancel</button>
				<button type="submit" class="btn-save">{editingServiceId ? 'Save' : 'Register & add'}</button>
			</div>
		</form>
	{/if}

	<div class="toolbar">
		<div class="search">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
			<input type="search" bind:value={serviceQuery} placeholder="Search services" aria-label="Search services" />
		</div>
		<select class="sort" bind:value={serviceSort} aria-label="Sort services">
			<option value="oldest">Oldest first</option>
			<option value="newest">Newest first</option>
			<option value="name-asc">Name A → Z</option>
			<option value="name-desc">Name Z → A</option>
		</select>
		{#if !showRegisterForm}
			<button class="btn-register" onclick={() => (showRegisterForm = true)}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
				New service
			</button>
		{/if}
	</div>

	{#if $services.length === 0}
		<p class="empty">No service yet. Register your first one with <b>New service</b>.</p>
	{:else if shownServices.length === 0}
		<p class="empty">No service matches “{serviceQuery}”.</p>
	{:else}
		<p class="count">{shownServices.length === $services.length ? `${$services.length} services` : `${shownServices.length} of ${$services.length} services`}</p>
		<div class="grid">
			{#each shownServices as service (service.id)}
				<div class="service-card" class:added={addedServiceIds.has(service.id)}>
					<div class="card-icon-wrapper">
						<img src={iconSrc(service)} alt={service.name} class="card-icon" loading="lazy" onerror={(e) => handleCardIconError(e, service)} />
						<div class="card-icon-fallback" style="display: none;">{service.name.charAt(0).toUpperCase()}</div>
					</div>
					<span class="card-name">{service.name}</span>
					<span class="card-desc">{service.description || service.url}</span>
					<div class="card-actions">
						<button class="btn-card-add" onclick={() => handleAddExisting(service.id)} title="Add to dashboard" aria-label="Add {service.name} to the dashboard">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
						</button>
						<button class="btn-card-edit" onclick={() => handleEditService(service)} title="Edit service" aria-label="Edit {service.name}">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
						</button>
						<button class="btn-card-delete" onclick={() => deleteService(service.id)} title="Delete service" aria-label="Delete {service.name}">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
