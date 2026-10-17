<script lang="ts">
	// "Add to dashboard": registered services (search, sort, register / edit),
	// and the widget catalog (search, categories), whose cards open the widget's
	// settings form before adding it. Connections live in Settings > Integrations.
	import { onMount } from 'svelte';
	import type { Service } from '$lib/stores/dashboard';
	import { services, registerService, updateService, deleteService, addServiceToDashboard, addWidgetToDashboard, addNavbarItem, activeGrid, openSettings } from '$lib/stores/dashboard';
	import { integrations, loadIntegrations } from '$lib/stores/integrations';
	import { integrationDef } from '$lib/integrations/registry';
	import { WIDGETS, WIDGET_CATEGORIES, draftFor, configFrom, missingConnections, type WidgetCategory, type WidgetDef, type WidgetTarget } from '$lib/widgets/catalog';
	import Glyph from '$lib/widgets/Glyph.svelte';
	import IconPicker from './IconPicker.svelte';
	import { iconSrc } from '$lib/utils/icons';

	let { onclose }: { onclose: () => void } = $props();
	let closing = $state(false);
	let activeTab = $state<'services' | 'widgets'>('services');

	onMount(() => {
		loadIntegrations(true);
	});

	function close() {
		closing = true;
		setTimeout(() => onclose(), 180);
	}

	/** Columns of the breakpoint shown (it may have been picked by hand in edit mode). */
	function getMaxCols(): number {
		return $activeGrid.columns;
	}

	// --- Services -----------------------------------------------------------------

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
		const list = q
			? $services.filter((s) => `${s.name} ${s.url} ${s.description}`.toLowerCase().includes(q))
			: [...$services];
		if (serviceSort === 'newest') list.reverse();
		else if (serviceSort === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
		else if (serviceSort === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
		return list;
	});

	function flashAdded(id: string) {
		addedServiceIds.add(id);
		addedServiceIds = new Set(addedServiceIds);
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
		await addServiceToDashboard(svc.id, getMaxCols());
		flashAdded(svc.id);
	}

	async function handleAddExisting(serviceId: string) {
		await addServiceToDashboard(serviceId, getMaxCols());
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

	// --- Widgets ------------------------------------------------------------------

	let widgetQuery = $state('');
	let category = $state<WidgetCategory | 'all'>('all');
	let picked = $state<WidgetDef | null>(null);
	let target = $state<WidgetTarget>('grid');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let draft = $state<Record<string, any>>({});
	let colSpan = $state(2);
	let rowSpan = $state(1);

	const catalog = $derived.by(() => {
		const q = widgetQuery.trim().toLowerCase();
		return WIDGETS.filter(
			(w) =>
				(category === 'all' || w.category === category) &&
				(!q || `${w.name} ${w.description} ${w.category} ${(w.integrations ?? []).map((k) => integrationDef(k)?.name).join(' ')}`.toLowerCase().includes(q))
		);
	});
	const categories = $derived(WIDGET_CATEGORIES.filter((c) => WIDGETS.some((w) => w.category === c)));

	const placeLabel = (w: WidgetDef) => (w.grid && w.navbar ? 'Dashboard + navbar' : w.navbar ? 'Navbar' : '');
	const needsLabel = (w: WidgetDef, missing: string[]) =>
		missing.length > 1 ? `Needs ${missing.map((k) => integrationDef(k as never)?.name).join(', ').replace(/, ([^,]*)$/, ' or $1')}` : `Needs ${integrationDef(missing[0] as never)?.name ?? 'a connection'}`;

	function sizeFor(def: WidgetDef, t: WidgetTarget) {
		if (t === 'navbar') return { cols: def.navbar!.colSpan, rows: 1 };
		return { cols: Math.min(def.grid!.colSpan, getMaxCols()), rows: def.grid!.rowSpan };
	}

	function pick(def: WidgetDef) {
		picked = def;
		target = def.grid ? 'grid' : 'navbar';
		draft = draftFor(def, undefined, target, $integrations);
		({ cols: colSpan, rows: rowSpan } = sizeFor(def, target));
	}

	function setTarget(t: WidgetTarget) {
		if (!picked || t === target) return;
		target = t;
		({ cols: colSpan, rows: rowSpan } = sizeFor(picked, t));
	}

	function setUp(def: WidgetDef) {
		const key = def.integrations?.[0];
		close();
		setTimeout(() => openSettings('integrations', key), 200);
	}

	const maxCols = $derived(target === 'navbar' ? $activeGrid.navbar.columns : $activeGrid.columns);
	const minCols = $derived(target === 'grid' ? Math.min(picked?.grid?.minColSpan ?? 1, $activeGrid.columns) : 1);
	const missing = $derived(picked?.missing?.(draft) ?? null);

	async function addPicked() {
		const def = picked;
		if (!def || missing) return;
		const d = $state.snapshot(draft);
		const config = configFrom(def, d, target);
		const cols = Math.min(maxCols, Math.max(minCols, Math.round(colSpan) || 1));
		const rows = Math.min(12, Math.max(1, Math.round(rowSpan) || 1));
		close();
		if (target === 'navbar') {
			await addNavbarItem(def.navbar!.type, cols, config);
		} else if (def.group) {
			await addWidgetToDashboard(def.grid!.type, String(d.title ?? '').trim() || 'New Group', cols, rows, getMaxCols(), d.compact ? { compact: true } : undefined);
		} else {
			await addWidgetToDashboard(def.grid!.type, '', cols, rows, getMaxCols(), config);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="popup-overlay" class:closing role="dialog" aria-modal="true" aria-label="Add to dashboard" tabindex="-1" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}>
	<div class="popup sheet-full" role="presentation" onclick={(e) => e.stopPropagation()}>
		<div class="popup-header">
			<h2>Add to dashboard</h2>
			<button class="btn-close" onclick={close} aria-label="Close">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="modal-body">
			<div class="sidebar">
				<button class="tab" class:active={activeTab === 'services'} onclick={() => (activeTab = 'services')}>Services</button>
				<button class="tab" class:active={activeTab === 'widgets'} onclick={() => (activeTab = 'widgets')}>Widgets</button>
			</div>

			{#if activeTab === 'services'}
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
			{:else if picked}
				<div class="tab-content cb-form configure">
					<div class="cfg-head">
						<button class="btn-back" onclick={() => (picked = null)} aria-label="Back to the widgets">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg>
						</button>
						<span class="cfg-icon"><Glyph name={picked.icon} size={24} /></span>
						<div>
							<h3>{picked.name}</h3>
							<p>{picked.description}</p>
						</div>
					</div>

					{#if picked.grid && picked.navbar}
						<div class="field">
							<span>Place in</span>
							<div class="seg">
								<button type="button" class:active={target === 'grid'} onclick={() => setTarget('grid')}>Dashboard</button>
								<button type="button" class:active={target === 'navbar'} onclick={() => setTarget('navbar')}>Navbar</button>
							</div>
						</div>
					{/if}

					{#if picked.settings}
						<picked.settings bind:config={draft} {target} {...picked.settingsProps} />
					{/if}

					<p class="group-title">Size</p>
					<div class="field-row">
						<label class="field">
							<span>Width (columns)</span>
							<input type="number" bind:value={colSpan} min={minCols} max={maxCols} />
						</label>
						{#if target === 'grid'}
							<label class="field">
								<span>Height (rows)</span>
								<input type="number" bind:value={rowSpan} min="1" max="12" />
							</label>
						{/if}
					</div>
					<p class="hint">You can resize it later on the dashboard, in edit mode.</p>

					<div class="cfg-actions">
						{#if missing}<span class="missing">{missing}</span>{/if}
						<button class="btn-cancel" onclick={() => (picked = null)}>Back</button>
						<button class="btn-save" onclick={addPicked} disabled={!!missing}>{target === 'navbar' ? 'Add to navbar' : 'Add to dashboard'}</button>
					</div>
				</div>
			{:else}
				<div class="tab-content">
					<div class="toolbar">
						<div class="search">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
							<input type="search" bind:value={widgetQuery} placeholder="Search widgets" aria-label="Search widgets" />
						</div>
					</div>
					<div class="chips-row" role="tablist" aria-label="Categories">
						<button class="cat" class:active={category === 'all'} role="tab" aria-selected={category === 'all'} onclick={() => (category = 'all')}>All</button>
						{#each categories as c (c)}
							<button class="cat" class:active={category === c} role="tab" aria-selected={category === c} onclick={() => (category = c)}>{c}</button>
						{/each}
					</div>

					{#if catalog.length === 0}
						<p class="empty">No widget matches “{widgetQuery}”.</p>
					{:else}
						<div class="catalog">
							{#each catalog as w (w.id)}
								{@const miss = missingConnections(w, $integrations)}
								<div class="wcard" class:locked={miss.length > 0}>
									<button class="wcard-main" onclick={() => pick(w)} disabled={miss.length > 0}>
										<span class="wcard-icon"><Glyph name={w.icon} size={22} /></span>
										<span class="wcard-text">
											<span class="wcard-name">{w.name}</span>
											<span class="wcard-desc">{w.description}</span>
										</span>
										{#if placeLabel(w)}<span class="badge">{placeLabel(w)}</span>{/if}
									</button>
									{#if miss.length}
										<div class="wcard-setup">
											<span>{needsLabel(w, miss)}</span>
											<button onclick={() => setUp(w)}>Set up</button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.popup-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.15s ease;
	}

	.popup-overlay.closing {
		animation: fadeOut 0.18s ease forwards;
	}

	.popup {
		background: var(--bg-modal);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		width: 960px;
		max-width: 94vw;
		height: 720px;
		max-height: 90vh;
		min-height: 500px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.popup-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.popup-header h2 {
		font-size: 1.1rem;
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
		flex: 1;
		display: flex;
		overflow: hidden;
		min-height: 0;
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		padding: 8px;
		width: 160px;
		flex-shrink: 0;
		overflow-y: auto;
	}

	.tab {
		padding: 10px 12px;
		font-weight: 500;
		font-size: 0.9rem;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		background: none;
		border: none;
		border-left: 3px solid transparent;
		text-align: left;
		transition: all var(--transition);
	}

	.tab.active {
		color: var(--accent);
		border-left-color: var(--accent);
		background: var(--accent-bg);
	}

	.tab:hover {
		color: var(--text-primary);
		background: var(--bg-card-hover);
	}

	.tab-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
		min-width: 0;
	}

	/* --- Toolbar (search, sort, new) --- */
	.toolbar {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
	}

	.search {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-muted);
	}

	.search:focus-within {
		border-color: var(--accent);
	}

	.search input {
		flex: 1;
		min-width: 0;
		padding: 8px 0;
		border: none;
		background: none;
		outline: none;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.sort {
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.85rem;
	}

	.btn-register {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		background: var(--accent);
		color: white;
		border-radius: var(--radius-sm);
		font-weight: 500;
		font-size: 0.88rem;
		white-space: nowrap;
	}

	.btn-register:hover {
		background: var(--accent-hover);
	}

	.empty,
	.count {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.empty {
		padding: 24px 0;
		text-align: center;
	}

	.count {
		margin-bottom: 8px;
		font-size: 0.75rem;
	}

	/* --- Register / edit form --- */
	.register-form {
		margin-bottom: 16px;
		padding: 14px 16px 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
	}

	.register-form h3 {
		font-size: 0.95rem;
		margin-bottom: 12px;
	}

	.form-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-bottom: 12px;
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

	.btn-save:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* --- Service cards --- */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 12px;
	}

	.service-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px 10px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		transition: all var(--transition);
		position: relative;
	}

	.service-card.added {
		outline: 2px solid var(--success, #22c55e);
		outline-offset: -2px;
		animation: pulseGreen 1.5s ease;
	}

	.card-icon-wrapper {
		width: 52px;
		height: 52px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(128, 128, 128, 0.12);
		border: 1px solid var(--border);
	}

	.card-icon {
		width: 36px;
		height: 36px;
		object-fit: contain;
	}

	.card-icon-fallback {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		font-weight: 700;
		color: white;
		background: var(--accent);
		border-radius: 50%;
	}

	.card-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.card-desc {
		font-size: 0.7rem;
		color: var(--text-muted);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.card-actions {
		display: flex;
		gap: 6px;
		margin-top: 4px;
	}

	.card-actions button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		color: var(--text-secondary);
		background: var(--bg-primary);
		transition: all var(--transition);
		cursor: pointer;
	}

	.card-actions button:hover {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.card-actions .btn-card-delete:hover {
		background: var(--danger);
		border-color: var(--danger);
	}

	/* --- Widget catalog --- */
	.chips-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 14px;
	}

	.cat {
		padding: 5px 12px;
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 0.8rem;
		color: var(--text-secondary);
		transition: all var(--transition);
	}

	.cat:hover {
		border-color: var(--accent);
		color: var(--text-primary);
	}

	.cat.active {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	.catalog {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 10px;
	}

	.wcard {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		overflow: hidden;
		transition: border-color var(--transition), box-shadow var(--transition);
	}

	.wcard:not(.locked):hover {
		border-color: var(--accent);
		box-shadow: var(--shadow);
	}

	.wcard-main {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 14px;
		text-align: left;
	}

	.wcard-main:disabled {
		cursor: default;
	}

	.wcard-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		background: var(--accent-bg);
		color: var(--accent);
	}

	.wcard.locked .wcard-icon {
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
		color: var(--text-muted);
	}

	.wcard-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.wcard-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.wcard.locked .wcard-name {
		color: var(--text-secondary);
	}

	.wcard-desc {
		font-size: 0.76rem;
		line-height: 1.35;
		color: var(--text-muted);
	}

	.badge {
		flex-shrink: 0;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 0.66rem;
		font-weight: 600;
		white-space: nowrap;
		background: color-mix(in srgb, var(--text-muted) 14%, transparent);
		color: var(--text-secondary);
	}

	.wcard-setup {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 7px 14px;
		border-top: 1px dashed var(--border);
		font-size: 0.76rem;
		color: var(--text-muted);
	}

	.wcard-setup button {
		padding: 3px 10px;
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		font-size: 0.76rem;
		font-weight: 600;
		color: var(--accent);
		white-space: nowrap;
	}

	.wcard-setup button:hover {
		background: var(--accent);
		color: white;
	}

	/* --- Configuration step --- */
	.configure {
		display: flex;
		flex-direction: column;
	}

	.configure > :not(.cfg-actions) {
		max-width: 640px;
	}

	.cfg-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 18px;
	}

	.cfg-head h3 {
		font-size: 1.05rem;
	}

	.cfg-head p {
		margin-top: 2px;
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	.btn-back {
		display: flex;
		padding: 6px;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
	}

	.btn-back:hover {
		background: var(--bg-card-hover);
		color: var(--text-primary);
	}

	.cfg-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		background: var(--accent-bg);
		color: var(--accent);
	}

	.cfg-actions {
		position: sticky;
		bottom: -16px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		margin: auto -20px -16px;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
		background: var(--bg-modal);
	}

	.missing {
		margin-right: auto;
		font-size: 0.8rem;
		color: var(--warning, #f59e0b);
	}

	@keyframes pulseGreen {
		0% { outline-color: var(--success, #22c55e); }
		70% { outline-color: var(--success, #22c55e); }
		100% { outline-color: transparent; }
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

	/* Phone: full-screen sheet, tabs in a row on top, two-column service cards. */
	@media (max-width: 640px) {
		.popup-header {
			padding: 12px 16px;
		}

		.modal-body {
			flex-direction: column;
		}

		.sidebar {
			flex-direction: row;
			width: auto;
			gap: 4px;
			padding: 6px 10px;
			border-right: none;
			border-bottom: 1px solid var(--border);
			overflow-x: auto;
			overflow-y: hidden;
			scrollbar-width: none;
			flex-shrink: 0;
		}

		.sidebar::-webkit-scrollbar {
			display: none;
		}

		.tab {
			flex: 1;
			padding: 9px 14px;
			border-left: none;
			border-bottom: 3px solid transparent;
			border-radius: var(--radius-sm) var(--radius-sm) 0 0;
			text-align: center;
			white-space: nowrap;
		}

		.tab.active {
			border-bottom-color: var(--accent);
		}

		.tab-content {
			padding: 14px;
		}

		.toolbar {
			flex-wrap: wrap;
		}

		.search {
			flex-basis: 100%;
		}

		.sort {
			flex: 1;
		}

		.chips-row {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
			margin: 0 -14px 14px;
			padding: 0 14px;
		}

		.cat {
			flex-shrink: 0;
		}

		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}

		.catalog {
			grid-template-columns: 1fr;
		}

		.cfg-actions {
			bottom: -14px;
			margin: auto -14px -14px;
			padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
			flex-wrap: wrap;
		}

		.cfg-actions .missing {
			flex-basis: 100%;
		}

		.cfg-actions button {
			flex: 1;
		}
	}
</style>
