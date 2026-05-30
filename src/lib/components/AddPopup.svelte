<script lang="ts">
	import type { Service } from '$lib/stores/dashboard';
	import { services, layout, registerService, updateService, deleteService, addServiceToDashboard, addWidgetToDashboard, addNavbarItem, getActiveColumns, getIntegrations, setIntegrations } from '$lib/stores/dashboard';
	import IconPicker from './IconPicker.svelte';

	let { onclose }: { onclose: () => void } = $props();
	let closing = $state(false);
	let activeTab = $state<'services' | 'widgets' | 'navbar' | 'integrations'>('services');
	let showRegisterForm = $state(false);
	let newServiceName = $state('');
	let newServiceUrl = $state('');
	let newServiceIcon = $state('');
	let newServiceDesc = $state('');
	let addedServiceIds = $state<Set<string>>(new Set());
	let editingServiceId = $state<string | null>(null);
	let widgetType = $state<'group-collapsible' | 'group-standard' | 'calendar' | 'clock' | 'weather'>('group-collapsible');
	let widgetTitle = $state('');
	let widgetColSpan = $state(6);
	let adguardHomeUrl = $state('');
	let adguardHomeUsername = $state('');
	let adguardHomePassword = $state('');
	let adguardHomeSaving = $state(false);
	let adguardWidgetType = $state<'stats' | 'control'>('stats');
	let adguardWidgetVersion = $state<'standard' | 'navbar'>('standard');
	let adguardWidgetColSpan = $state(4);
	let adguardWidgetRowSpan = $state(2);
	let adguardWidgetAlign = $state<'left' | 'center' | 'right'>('center');


	$effect(() => {
		if (widgetType === 'clock') widgetColSpan = 2;
		else if (widgetType === 'weather') widgetColSpan = 2;
		else if (widgetType === 'calendar') widgetColSpan = 4;
	});
	let widgetCompact = $state(false);
	let navbarWidgetType = $state<'navbar-title' | 'navbar-search' | 'navbar-cpu' | 'navbar-ram' | 'navbar-disk'>('navbar-cpu');
	let navbarColSpan = $state(2);
	let diskPaths = $state<string[]>([]);
	let availableDisks = $state<string[]>([]);
	let tempSensors = $state<string[]>([]);
	let selectedTempSensor = $state('');
	let tempSensorsLoading = $state(false);
	let tempSensorsDetected = $state(false);
	let disksLoading = $state(false);
	let disksDetected = $state(false);

	let integrationSubTab = $state<'connections' | 'widgets'>('connections');
	let uptimeKumaUrl = $state('');
	let uptimeKumaUrlSaving = $state(false);
	let uptimeKumaUrlSaved = $state(false);
	let selectedStatusPageSlug = $state('');
	let integrationWidgetVersion = $state<'standard' | 'navbar'>('standard');
	let integrationWidgetColSpan = $state(4);
	let integrationWidgetRowSpan = $state(2);
	let dockerEnvironments = $state<{ id: string; name: string; url: string }[]>([]);
	let dockerEnvSaving = $state(false);
	let dockerWidgetEnvId = $state('');
	let dockerWidgetVersion = $state<'standard' | 'navbar'>('standard');
	let dockerWidgetColSpan = $state(4);
	let dockerWidgetRowSpan = $state(2);

	let radarrUrl = $state('');
	let radarrApiKey = $state('');
	let radarrSaving = $state(false);
	let sonarrUrl = $state('');
	let sonarrApiKey = $state('');
	let sonarrSaving = $state(false);
	let lidarrUrl = $state('');
	let lidarrApiKey = $state('');
	let lidarrSaving = $state(false);

	let jellyfinUrl = $state('');
	let jellyfinApiKey = $state('');
	let jellyfinSaving = $state(false);
	let jellyfinWidgetColSpan = $state(4);
	let jellyfinWidgetRowSpan = $state(3);

	$effect(() => {
		if (activeTab === 'integrations') loadIntegrationsConfig();
	});

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

	async function loadIntegrationsConfig() {
		try {
			const config = await getIntegrations();
			if (config.uptimeKuma?.url) {
				uptimeKumaUrl = config.uptimeKuma.url;
				uptimeKumaUrlSaved = true;
			}
			dockerEnvironments = config.docker?.environments || [];
			radarrUrl = config.radarr?.url || '';
		if (config.adguardHome) {
			adguardHomeUrl = config.adguardHome.url || '';
			adguardHomeUsername = config.adguardHome.username || '';
			adguardHomePassword = config.adguardHome.password || '';
		}
			radarrApiKey = config.radarr?.apiKey || '';
			sonarrUrl = config.sonarr?.url || '';
			sonarrApiKey = config.sonarr?.apiKey || '';
			lidarrUrl = config.lidarr?.url || '';
			lidarrApiKey = config.lidarr?.apiKey || '';
			jellyfinUrl = config.jellyfin?.url || '';
			jellyfinApiKey = config.jellyfin?.apiKey || '';
		} catch {
			// ignore
		}
	}

	function toggleDiskPath(path: string) {
		if (diskPaths.includes(path)) {
			diskPaths = diskPaths.filter(p => p !== path);
		} else {
			diskPaths = [...diskPaths, path];
		}
	}

	function getMaxCols(): number {
		const bps = $layout?.grid?.breakpoints || [{ minWidth: 0, columns: 4 }];
		return getActiveColumns(bps, window.innerWidth);
	}

	async function handleRegister(e: Event) {
		e.preventDefault();
		const name = newServiceName;
		const url = newServiceUrl;
		const icon = newServiceIcon;
		const desc = newServiceDesc;
		if (editingServiceId) {
			await updateService(editingServiceId, { name, url, icon, description: desc });
			resetForm();
			return;
		}
		resetForm();
		const svc = await registerService({
			name,
			url,
			icon,
			description: desc,
			statusCheck: { enabled: true, method: 'HEAD' }
		});
		await addServiceToDashboard(svc.id, getMaxCols());
		addedServiceIds.add(svc.id);
		setTimeout(() => {
			addedServiceIds.delete(svc.id);
			addedServiceIds = addedServiceIds;
		}, 1500);
	}

	async function handleAddExisting(serviceId: string) {
		await addServiceToDashboard(serviceId, getMaxCols());
		addedServiceIds.add(serviceId);
		setTimeout(() => {
			addedServiceIds.delete(serviceId);
			addedServiceIds = addedServiceIds;
		}, 1500);
	}

	async function handleDeleteService(id: string) {
		await deleteService(id);
	}

	async function handleAddWidget(e: Event) {
		e.preventDefault();
		const type = widgetType;
		const title = widgetTitle || 'New Group';
		const cols = widgetColSpan;
		widgetTitle = '';
		close();
		if (type === 'calendar') {
			await addWidgetToDashboard('calendar', '', cols, 2, getMaxCols());
		} else if (type === 'clock') {
			await addWidgetToDashboard('clock', '', cols, 1, getMaxCols());
		} else if (type === 'weather') {
			await addWidgetToDashboard('weather', '', cols, 1, getMaxCols());
		} else {
			const config = type === 'group-standard' && widgetCompact ? { compact: true } : undefined;
			await addWidgetToDashboard(type, title, cols, 3, getMaxCols(), config);
		}
	}

	async function handleAddNavbarWidget() {
		let config: Record<string, unknown> | undefined;
		if (navbarWidgetType === 'navbar-disk') {
			config = { disks: diskPaths.length > 0 ? diskPaths : undefined };
		} else if (navbarWidgetType === 'navbar-cpu' && selectedTempSensor) {
			config = { tempSensor: selectedTempSensor };
		}
		close();
		await addNavbarItem(navbarWidgetType, navbarColSpan, config);
	}

	function buildArrConnection(url: string, apiKey: string) {
		return url ? { url: url.trim(), apiKey: apiKey.trim() } : undefined;
	}

	async function handleSaveUptimeKumaUrl() {
		uptimeKumaUrlSaving = true;
		try {
			await setIntegrations({ uptimeKuma: { url: uptimeKumaUrl.trim() } });
			uptimeKumaUrlSaved = true;
		} catch {
			// ignore
		} finally {
			uptimeKumaUrlSaving = false;
		}
	}

	async function handleAddIntegrationWidget() {
		if (!selectedStatusPageSlug.trim()) return;
		close();
		if (integrationWidgetVersion === 'standard') {
			await addWidgetToDashboard('uptime-kuma-status-page', '', integrationWidgetColSpan, integrationWidgetRowSpan, getMaxCols(), { slug: selectedStatusPageSlug.trim() });
		} else {
			await addNavbarItem('navbar-uptime-kuma-status-page', integrationWidgetColSpan, { slug: selectedStatusPageSlug.trim() });
		}
	}

	async function handleSaveDockerEnvironments() {
		dockerEnvSaving = true;
		try {
			await setIntegrations({ docker: { environments: dockerEnvironments } });
		} catch {
			// ignore
		} finally {
			dockerEnvSaving = false;
		}
	}

	function addDockerEnvironment() {
		dockerEnvironments = [...dockerEnvironments, { id: crypto.randomUUID(), name: '', url: '' }];
	}

	function removeDockerEnvironment(id: string) {
		dockerEnvironments = dockerEnvironments.filter(e => e.id !== id);
	}

	async function handleAddDockerWidget() {
		if (!dockerWidgetEnvId) return;
		close();
		if (dockerWidgetVersion === 'standard') {
			await addWidgetToDashboard('docker', '', dockerWidgetColSpan, dockerWidgetRowSpan, getMaxCols(), { environmentId: dockerWidgetEnvId });
		} else {
			await addNavbarItem('navbar-docker', dockerWidgetColSpan, { environmentId: dockerWidgetEnvId });
		}
	}

	async function handleSaveRadarr() {
		radarrSaving = true;
		try {
			await setIntegrations({ radarr: buildArrConnection(radarrUrl, radarrApiKey) });
		} catch {
			// ignore
		} finally {
			radarrSaving = false;
		}
	}

	async function handleSaveSonarr() {
		sonarrSaving = true;
		try {
			await setIntegrations({ sonarr: buildArrConnection(sonarrUrl, sonarrApiKey) });
		} catch {
			// ignore
		} finally {
			sonarrSaving = false;
		}
	}

	async function handleSaveLidarr() {
		lidarrSaving = true;
		try {
			await setIntegrations({ lidarr: buildArrConnection(lidarrUrl, lidarrApiKey) });
		} catch {
			// ignore
		} finally {
			lidarrSaving = false;
		}
	}

	async function handleSaveJellyfin() {
		jellyfinSaving = true;
		try {
			await setIntegrations({ jellyfin: buildArrConnection(jellyfinUrl, jellyfinApiKey) });
		} catch {
			// ignore
		} finally {
			jellyfinSaving = false;
		}
	}

	async function handleAddJellyfinWidget() {
		close();
		await addWidgetToDashboard('jellyfin-latest', '', jellyfinWidgetColSpan, jellyfinWidgetRowSpan, getMaxCols(), { instanceId: 'default', limit: 5 });
	}

	async function handleSaveAdGuard() {
		adguardHomeSaving = true;
		try {
			await setIntegrations({
				adguardHome: adguardHomeUrl
					? { url: adguardHomeUrl.trim(), username: adguardHomeUsername.trim(), password: adguardHomePassword.trim() }
					: undefined
			});
		} catch {
			// ignore
		} finally {
			adguardHomeSaving = false;
		}
	}

	async function handleAddAdGuardWidget() {
		close();
		if (adguardWidgetVersion === 'standard') {
			const type = adguardWidgetType === 'stats' ? 'adguard-home' : 'adguard-home-control';
			await addWidgetToDashboard(type, '', adguardWidgetColSpan, adguardWidgetRowSpan, getMaxCols(), { instanceId: 'default' });
		} else {
			await addNavbarItem('navbar-adguard-home-control', adguardWidgetColSpan, { instanceId: 'default', align: adguardWidgetAlign });
		}
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

	function handleCardIconError(e: Event, service: Service) {
		const img = e.currentTarget as HTMLImageElement;
		if (img.src.includes('cdn.jsdelivr.net')) {
			img.src = `/icons/${service.icon}.svg`;
		} else if (img.src.includes('/icons/')) {
			img.src = `/api/icon?url=${encodeURIComponent(service.url)}`;
		} else {
			img.style.display = 'none';
			const fallback = img.parentElement?.querySelector('.card-icon-fallback') as HTMLElement | null;
			if (fallback) fallback.style.display = 'flex';
		}
	}

	function close() {
		closing = true;
		setTimeout(() => onclose(), 180);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="popup-overlay" class:closing role="dialog" aria-modal="true" tabindex="-1" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}>
	<div class="popup" onclick={(e) => e.stopPropagation()}>
		<div class="popup-header">
			<h2>Add to Dashboard</h2>
			<button class="btn-close" onclick={close}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="modal-body">
			<div class="sidebar">
				<button class="tab" class:active={activeTab === 'services'} onclick={() => (activeTab = 'services')}>Services</button>
				<button class="tab" class:active={activeTab === 'widgets'} onclick={() => (activeTab = 'widgets')}>Widgets</button>
				<button class="tab" class:active={activeTab === 'navbar'} onclick={() => (activeTab = 'navbar')}>Navbar</button>
				<button class="tab" class:active={activeTab === 'integrations'} onclick={() => (activeTab = 'integrations')}>Integrations</button>
			</div>

		{#if activeTab === 'services'}
				<div class="tab-content">
					{#if !showRegisterForm}
						<button class="btn-register" onclick={() => (showRegisterForm = true)}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 5v14M5 12h14" />
							</svg>
							{editingServiceId ? 'Edit Service' : 'Register New Service'}
						</button>
					{:else}
						<form class="register-form" onsubmit={handleRegister}>
							<h3>{editingServiceId ? 'Edit Service' : 'Register New Service'}</h3>
							<div class="field">
								<label>Name</label>
								<input type="text" bind:value={newServiceName} required placeholder="Proxmox" />
							</div>
							<div class="field">
								<label>URL</label>
								<input type="url" bind:value={newServiceUrl} required placeholder="https://proxmox.home.local" />
							</div>
							<div class="field">
								<label>Icon</label>
								<IconPicker value={newServiceIcon} onchange={(v) => (newServiceIcon = v)} />
							</div>
							<div class="field">
								<label>Description</label>
								<input type="text" bind:value={newServiceDesc} placeholder="Hypervisor" />
							</div>
							<div class="form-actions">
								<button type="button" class="btn-cancel" onclick={resetForm}>Cancel</button>
								<button type="submit" class="btn-save">{editingServiceId ? 'Save' : 'Register & Add'}</button>
							</div>
						</form>
					{/if}

					{#if $services.length > 0}
							<div class="service-grid">
								<h3>Registered Services</h3>
								<div class="grid">
									{#each $services as service (service.id)}
										<div class="service-card" class:added={addedServiceIds.has(service.id)}>
											<div class="card-icon-wrapper">
												{#if service.icon}
													<img src={`https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${service.icon}.svg`} alt={service.name} class="card-icon" onerror={(e) => handleCardIconError(e, service)} />
													<div class="card-icon-fallback" style="display: none;">{service.name.charAt(0).toUpperCase()}</div>
												{:else}
													<div class="card-icon-fallback">{service.name.charAt(0).toUpperCase()}</div>
												{/if}
											</div>
											<span class="card-name">{service.name}</span>
											<span class="card-desc">{service.description || service.url}</span>
											<div class="card-actions">
												<button class="btn-card-add" onclick={() => handleAddExisting(service.id)} title="Add to dashboard">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<path d="M12 5v14M5 12h14" />
													</svg>
												</button>
												<button class="btn-card-edit" onclick={() => handleEditService(service)} title="Edit service">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
														<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
													</svg>
												</button>
												<button class="btn-card-delete" onclick={() => handleDeleteService(service.id)} title="Delete service">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
													</svg>
												</button>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
				</div>{:else if activeTab === 'widgets'}
			<div class="tab-content">
				<form class="widget-form" onsubmit={handleAddWidget}>
					<h3>Add Widget</h3>
					<div class="widget-options">
						<button type="button" class="widget-option" class:active={widgetType === 'group-collapsible'} onclick={() => (widgetType = 'group-collapsible')}>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M9 18l6-6-6-6" />
								<rect x="3" y="3" width="18" height="18" rx="2" />
							</svg>
							<span>Collapsible Group</span>
						</button>
						<button type="button" class="widget-option" class:active={widgetType === 'group-standard'} onclick={() => (widgetType = 'group-standard')}>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<rect x="3" y="3" width="18" height="18" rx="2" />
								<path d="M3 9h18" />
							</svg>
							<span>Standard Group</span>
						</button>
						<button type="button" class="widget-option" class:active={widgetType === 'calendar'} onclick={() => (widgetType = 'calendar')}>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<rect x="3" y="4" width="18" height="18" rx="2" />
								<path d="M16 2v4M8 2v4M3 10h18" />
							</svg>
							<span>Calendar</span>
						</button>
						<button type="button" class="widget-option" class:active={widgetType === 'clock'} onclick={() => (widgetType = 'clock')}>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<circle cx="12" cy="12" r="10" />
								<path d="M12 6v6l4 2" />
							</svg>
							<span>Clock</span>
						</button>
						<button type="button" class="widget-option" class:active={widgetType === 'weather'} onclick={() => (widgetType = 'weather')}>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
							</svg>
							<span>Weather</span>
						</button>
					</div>
					{#if widgetType !== 'calendar' && widgetType !== 'clock' && widgetType !== 'weather'}
						<div class="field">
							<label>Title</label>
							<input type="text" bind:value={widgetTitle} placeholder="Infrastructure" />
						</div>
					{/if}
					{#if widgetType === 'group-standard'}
						<label class="toggle-switch">
							<input type="checkbox" bind:checked={widgetCompact} />
							<span class="toggle-slider"></span>
							<span class="toggle-label">Compact mode (no header)</span>
						</label>
					{/if}
					<div class="field">
						<label>Width (columns)</label>
						<input type="number" bind:value={widgetColSpan} min={(widgetType === "clock" || widgetType === "weather") ? 1 : 2} max="12" />
					</div>
					<button type="submit" class="btn-save">Add Widget</button>
				</form>
			</div>
		{:else if activeTab === 'navbar'}
			<div class="tab-content">
				<h3>Add Navbar Widget</h3>
				<div class="widget-options">
					<button type="button" class="widget-option" class:active={navbarWidgetType === 'navbar-title'} onclick={() => (navbarWidgetType = 'navbar-title')}>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M4 7V4h16v3M9 20h6M12 4v16" />
						</svg>
						<span>Title</span>
					</button>
					<button type="button" class="widget-option" class:active={navbarWidgetType === 'navbar-search'} onclick={() => (navbarWidgetType = 'navbar-search')}>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<circle cx="11" cy="11" r="8" />
							<path d="M21 21l-4.35-4.35" />
						</svg>
						<span>Search</span>
					</button>
					<button type="button" class="widget-option" class:active={navbarWidgetType === 'navbar-cpu'} onclick={() => { navbarWidgetType = 'navbar-cpu'; loadTempSensors(); }}>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<rect x="4" y="4" width="16" height="16" rx="2" />
							<path d="M9 9h6v6H9z" />
							<path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
						</svg>
						<span>CPU</span>
					</button>
					<button type="button" class="widget-option" class:active={navbarWidgetType === 'navbar-ram'} onclick={() => (navbarWidgetType = 'navbar-ram')}>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<rect x="2" y="6" width="20" height="12" rx="2" />
							<path d="M6 6v-2M10 6v-2M14 6v-2M18 6v-2M6 18v2M10 18v2M14 18v2M18 18v2" />
						</svg>
						<span>RAM</span>
					</button>
					<button type="button" class="widget-option" class:active={navbarWidgetType === 'navbar-disk'} onclick={() => { navbarWidgetType = 'navbar-disk'; loadAvailableDisks(); }}>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<ellipse cx="12" cy="5" rx="9" ry="3" />
							<path d="M21 5v6c0 1.66-4.03 3-9 3s-9-1.34-9-3V5" />
							<path d="M21 12v6c0 1.66-4.03 3-9 3s-9-1.34-9-3v-6" />
						</svg>
						<span>Disk</span>
					</button>
				</div>
				{#if navbarWidgetType === 'navbar-cpu'}
					<div class="field">
						<label>Temperature sensor</label>
						{#if tempSensorsLoading}
							<div class="detect-status">Detecting...</div>
						{:else if tempSensorsDetected && tempSensors.length > 0}
							<select bind:value={selectedTempSensor}>
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
				{/if}
				{#if navbarWidgetType === 'navbar-disk'}
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
				{/if}
				<div class="field">
					<label>Width (columns)</label>
					<input type="number" bind:value={navbarColSpan} min="1" max="6" />
				</div>
				<button type="button" class="btn-save" onclick={handleAddNavbarWidget}>Add to Navbar</button>
			</div>
		{:else if activeTab === 'integrations'}
			<div class="tab-content">
				<div class="sub-tabs">
					<button class="sub-tab" class:active={integrationSubTab === 'connections'} onclick={() => (integrationSubTab = 'connections')}>Connections</button>
					<button class="sub-tab" class:active={integrationSubTab === 'widgets'} onclick={() => (integrationSubTab = 'widgets')}>Widgets</button>
				</div>

				{#if integrationSubTab === 'connections'}
					<div class="integration-card">
						<div class="integration-header">
							<div class="integration-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<circle cx="12" cy="12" r="10" />
									<path d="M12 6v6l4 2" />
								</svg>
							</div>
							<div class="integration-info">
								<span class="integration-name">Uptime Kuma</span>
								<span class="integration-desc">Monitor your services uptime and display status pages</span>
							</div>
						</div>
						<div class="field">
							<label>Instance URL</label>
							<input type="url" bind:value={uptimeKumaUrl} placeholder="https://uptime-kuma.example.com" />
						</div>
						<div class="form-actions">
							<button type="button" class="btn-save" onclick={handleSaveUptimeKumaUrl} disabled={uptimeKumaUrlSaving}>
								{uptimeKumaUrlSaving ? 'Saving...' : (uptimeKumaUrlSaved ? 'Saved' : 'Save')}
							</button>
						</div>
					</div>

				<div class="integration-card">
					<div class="integration-header">
						<div class="integration-icon docker-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M2 15h4v4H2zM9 15h4v4H9zM16 15h4v4h-4zM2 9h4v4H2zM9 9h4v4H9zM16 9h4v4h-4zM9 3h4v4H9z" />
							</svg>
						</div>
						<div class="integration-info">
							<span class="integration-name">Docker</span>
							<span class="integration-desc">Monitor container status across Docker environments</span>
						</div>
					</div>
					{#if dockerEnvironments.length > 0}
						<div class="env-list">
							{#each dockerEnvironments as env, i}
								<div class="env-row">
									<div class="env-fields">
										<input type="text" bind:value={env.name} placeholder="Name (e.g. Local)" class="env-name-input" />
										<input type="text" bind:value={env.url} placeholder="Socket path or URL (e.g. /var/run/docker.sock)" class="env-url-input" />
									</div>
									<button type="button" class="btn-remove-env" onclick={() => removeDockerEnvironment(env.id)} title="Remove">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M18 6L6 18M6 6l12 12" />
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{/if}
					<button type="button" class="btn-add-env" onclick={addDockerEnvironment}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 5v14M5 12h14" />
						</svg>
						Add environment
					</button>
					<div class="form-actions">
						<button type="button" class="btn-save" onclick={handleSaveDockerEnvironments} disabled={dockerEnvSaving}>
							{dockerEnvSaving ? 'Saving...' : 'Save'}
						</button>
					</div>
				</div>
				

					<div class="integration-card">
						<div class="integration-header">
							<div class="integration-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<rect x="2" y="2" width="20" height="20" rx="2.18" />
									<line x1="7" y1="2" x2="7" y2="22" />
									<path d="M17 8l-5 5-5-5" />
								</svg>
							</div>
							<div class="integration-info">
								<span class="integration-name">Radarr</span>
								<span class="integration-desc">Track upcoming movie releases</span>
							</div>
						</div>
						<div class="field">
							<label>Instance URL</label>
							<input type="url" bind:value={radarrUrl} placeholder="https://radarr.home.local" />
						</div>
						<div class="field">
							<label>API Key</label>
							<input type="password" bind:value={radarrApiKey} placeholder="Your Radarr API key" />
						</div>
						<div class="form-actions">
							<button type="button" class="btn-save" onclick={handleSaveRadarr} disabled={radarrSaving}>
								{radarrSaving ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>

					<div class="integration-card">
						<div class="integration-header">
							<div class="integration-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<rect x="2" y="7" width="20" height="15" rx="2.18" />
									<path d="M17 2l-5 5-5-5" />
								</svg>
							</div>
							<div class="integration-info">
								<span class="integration-name">Sonarr</span>
								<span class="integration-desc">Track upcoming TV episode releases</span>
							</div>
						</div>
						<div class="field">
							<label>Instance URL</label>
							<input type="url" bind:value={sonarrUrl} placeholder="https://sonarr.home.local" />
						</div>
						<div class="field">
							<label>API Key</label>
							<input type="password" bind:value={sonarrApiKey} placeholder="Your Sonarr API key" />
						</div>
						<div class="form-actions">
							<button type="button" class="btn-save" onclick={handleSaveSonarr} disabled={sonarrSaving}>
								{sonarrSaving ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>

					<div class="integration-card">
						<div class="integration-header">
							<div class="integration-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<circle cx="12" cy="12" r="10" />
									<circle cx="12" cy="12" r="3" />
									<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
								</svg>
							</div>
							<div class="integration-info">
								<span class="integration-name">Lidarr</span>
								<span class="integration-desc">Track upcoming music album releases</span>
							</div>
						</div>
						<div class="field">
							<label>Instance URL</label>
							<input type="url" bind:value={lidarrUrl} placeholder="https://lidarr.home.local" />
						</div>
						<div class="field">
							<label>API Key</label>
							<input type="password" bind:value={lidarrApiKey} placeholder="Your Lidarr API key" />
						</div>
						<div class="form-actions">
							<button type="button" class="btn-save" onclick={handleSaveLidarr} disabled={lidarrSaving}>
								{lidarrSaving ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>

										<div class="integration-card">
						<div class="integration-header">
							<div class="integration-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<rect x="2" y="2" width="20" height="20" rx="2.18" />
									<circle cx="12" cy="12" r="5" />
									<path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
								</svg>
							</div>
							<div class="integration-info">
								<span class="integration-name">Jellyfin</span>
								<span class="integration-desc">Display recently added media items</span>
							</div>
						</div>
						<div class="field">
							<label>Instance URL</label>
							<input type="url" bind:value={jellyfinUrl} placeholder="https://jellyfin.home.local" />
						</div>
						<div class="field">
							<label>API Key</label>
							<input type="password" bind:value={jellyfinApiKey} placeholder="Your Jellyfin API key" />
						</div>
						<div class="form-actions">
							<button type="button" class="btn-save" onclick={handleSaveJellyfin} disabled={jellyfinSaving}>
								{jellyfinSaving ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>

<div class="integration-card">
						<div class="integration-header">
							<div class="integration-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
									<path d="M12 6v6l4 2" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							</div>
							<div class="integration-info">
								<span class="integration-name">AdGuard Home</span>
								<span class="integration-desc">Monitor and control DNS filtering</span>
							</div>
						</div>
						<div class="field">
							<label>Instance URL</label>
							<input type="url" bind:value={adguardHomeUrl} placeholder="http://adguard.home.local" />
						</div>
						<div class="field">
							<label>Username</label>
							<input type="text" bind:value={adguardHomeUsername} placeholder="Admin username" />
						</div>
						<div class="field">
							<label>Password</label>
							<input type="password" bind:value={adguardHomePassword} placeholder="Admin password" />
						</div>
						<div class="form-actions">
							<button type="button" class="btn-save" onclick={handleSaveAdGuard} disabled={adguardHomeSaving}>
								{adguardHomeSaving ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>

					{:else}
					<div class="integration-card">
						<div class="integration-header">
							<div class="integration-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
									<circle cx="12" cy="12" r="10" />
									<path d="M12 6v6l4 2" />
								</svg>
							</div>
							<div class="integration-info">
								<span class="integration-name">Uptime Kuma Status Page</span>
								<span class="integration-desc">Display status page monitors with uptime percentages</span>
							</div>
						</div>
						{#if !uptimeKumaUrl}
							<p class="hint">Configure the Uptime Kuma connection first.</p>
						{:else}
							<div class="field">
								<label>Status page slug</label>
								<input type="text" bind:value={selectedStatusPageSlug} placeholder="e.g. default" />
							</div>
							<div class="field">
								<label>Version</label>
								<div class="side-toggle">
									<button class="side-btn" class:active={integrationWidgetVersion === 'standard'} onclick={() => (integrationWidgetVersion = 'standard')}>Standard</button>
									<button class="side-btn" class:active={integrationWidgetVersion === 'navbar'} onclick={() => (integrationWidgetVersion = 'navbar')}>Navbar</button>
								</div>
							</div>
							{#if integrationWidgetVersion === 'standard'}
								<div class="size-row">
									<div class="field">
										<label>Width (columns)</label>
										<input type="number" bind:value={integrationWidgetColSpan} min="1" max="12" />
									</div>
									<div class="field">
										<label>Height (rows)</label>
										<input type="number" bind:value={integrationWidgetRowSpan} min="1" max="12" />
									</div>
								</div>
							{:else}
								<div class="field">
									<label>Width (columns)</label>
									<input type="number" bind:value={integrationWidgetColSpan} min="1" max="6" />
								</div>
							{/if}
							<div class="form-actions">
								<button type="button" class="btn-save" onclick={handleAddIntegrationWidget} disabled={!selectedStatusPageSlug.trim()}>Add Widget</button>
							</div>
						{/if}
					</div>

				<div class="integration-card">
					<div class="integration-header">
						<div class="integration-icon docker-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M2 15h4v4H2zM9 15h4v4H9zM16 15h4v4h-4zM2 9h4v4H2zM9 9h4v4H9zM16 9h4v4h-4zM9 3h4v4H9z" />
							</svg>
						</div>
						<div class="integration-info">
							<span class="integration-name">Docker Containers</span>
							<span class="integration-desc">Display container status with running/stopped counts</span>
						</div>
					</div>
					{#if dockerEnvironments.length === 0}
						<p class="hint">Configure Docker environments in the Connections tab first.</p>
					{:else}
						<div class="field">
							<label>Environment</label>
							<select bind:value={dockerWidgetEnvId}>
								<option value="">Select environment</option>
								{#each dockerEnvironments as env}
									<option value={env.id}>{env.name || env.url}</option>
								{/each}
							</select>
						</div>
						<div class="field">
							<label>Version</label>
							<div class="side-toggle">
								<button class="side-btn" class:active={dockerWidgetVersion === 'standard'} onclick={() => (dockerWidgetVersion = 'standard')}>Standard</button>
								<button class="side-btn" class:active={dockerWidgetVersion === 'navbar'} onclick={() => (dockerWidgetVersion = 'navbar')}>Navbar</button>
							</div>
						</div>
						{#if dockerWidgetVersion === 'standard'}
							<div class="size-row">
								<div class="field">
									<label>Width (columns)</label>
									<input type="number" bind:value={dockerWidgetColSpan} min="1" max="12" />
								</div>
								<div class="field">
									<label>Height (rows)</label>
									<input type="number" bind:value={dockerWidgetRowSpan} min="1" max="12" />
								</div>
							</div>
						{:else}
							<div class="field">
								<label>Width (columns)</label>
								<input type="number" bind:value={dockerWidgetColSpan} min="1" max="6" />
							</div>
						{/if}
						<div class="form-actions">
							<button type="button" class="btn-save" onclick={handleAddDockerWidget} disabled={!dockerWidgetEnvId}>Add Widget</button>
						</div>
					{/if}
				</div>

				<div class="integration-card">
					<div class="integration-header">
						<div class="integration-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
								<path d="M12 6v6l4 2" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						</div>
						<div class="integration-info">
							<span class="integration-name">AdGuard Home</span>
							<span class="integration-desc">Display stats or control DNS filtering</span>
						</div>
					</div>
					{#if !adguardHomeUrl}
						<p class="hint">Configure the AdGuard Home connection first.</p>
					{:else}
							{#if adguardWidgetVersion === 'standard'}
						<div class="field">
							<label>Widget Type</label>
							<div class="side-toggle">
								<button class="side-btn" class:active={adguardWidgetType === 'stats'} onclick={() => (adguardWidgetType = 'stats')}>Stats</button>
								<button class="side-btn" class:active={adguardWidgetType === 'control'} onclick={() => (adguardWidgetType = 'control')}>Control</button>
							</div>
						</div>
							{/if}
						<div class="field">
							<label>Version</label>
							<div class="side-toggle">
								<button class="side-btn" class:active={adguardWidgetVersion === 'standard'} onclick={() => (adguardWidgetVersion = 'standard')}>Standard</button>
								<button class="side-btn" class:active={adguardWidgetVersion === 'navbar'} onclick={() => (adguardWidgetVersion = 'navbar')}>Navbar</button>
							</div>
						</div>
						{#if adguardWidgetVersion === 'standard'}
							<div class="size-row">
								<div class="field">
									<label>Width (columns)</label>
									<input type="number" bind:value={adguardWidgetColSpan} min="1" max="12" />
								</div>
								<div class="field">
									<label>Height (rows)</label>
									<input type="number" bind:value={adguardWidgetRowSpan} min="1" max="12" />
								</div>
							</div>
						{:else}
							<div class="field">
								<label>Width (columns)</label>
								<input type="number" bind:value={adguardWidgetColSpan} min="1" max="6" />
							</div>
							<div class="field">
								<label>Alignment</label>
								<div class="side-toggle">
									<button class="side-btn" class:active={adguardWidgetAlign === 'left'} onclick={() => (adguardWidgetAlign = 'left')}>Left</button>
									<button class="side-btn" class:active={adguardWidgetAlign === 'center'} onclick={() => (adguardWidgetAlign = 'center')}>Center</button>
									<button class="side-btn" class:active={adguardWidgetAlign === 'right'} onclick={() => (adguardWidgetAlign = 'right')}>Right</button>
								</div>
							</div>
						{/if}
						<div class="form-actions">
							<button type="button" class="btn-save" onclick={handleAddAdGuardWidget}>Add Widget</button>
						</div>
					{/if}
				</div>

				<div class="integration-card">
					<div class="integration-header">
						<div class="integration-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
								<rect x="2" y="2" width="20" height="20" rx="2.18" />
								<circle cx="12" cy="12" r="5" />
								<path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
							</svg>
						</div>
						<div class="integration-info">
							<span class="integration-name">Jellyfin Latest</span>
							<span class="integration-desc">Display recently added media from Jellyfin</span>
						</div>
					</div>
					{#if !jellyfinUrl}
						<p class="hint">Configure the Jellyfin connection first.</p>
					{:else}
						<div class="size-row">
							<div class="field">
								<label>Width (columns)</label>
								<input type="number" bind:value={jellyfinWidgetColSpan} min="1" max="12" />
							</div>
							<div class="field">
								<label>Height (rows)</label>
								<input type="number" bind:value={jellyfinWidgetRowSpan} min="1" max="12" />
							</div>
						</div>
						<div class="form-actions">
							<button type="button" class="btn-save" onclick={handleAddJellyfinWidget}>Add Widget</button>
						</div>
					{/if}
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
		border-left: 3px solid transparent;
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

	.btn-register {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px;
		background: var(--accent);
		color: white;
		border-radius: var(--radius-sm);
		font-weight: 500;
		margin-bottom: 16px;
	}

	.btn-register:hover {
		background: var(--accent-hover);
	}

	.register-form {
		margin-bottom: 16px;
	}

	.register-form h3, .service-list h3, .widget-form h3 {
		font-size: 0.9rem;
		margin-bottom: 10px;
		color: var(--text-secondary);
	}

	.field {
		margin-bottom: 10px;
	}

	.field label {
		display: block;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: 3px;
	}

	.field input {
		width: 100%;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.9rem;
	}

	.field input:focus {
		border-color: var(--accent);
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

	.form-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 12px;
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

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.service-list {
		border-top: 1px solid var(--border);
		padding-top: 12px;
	}

	.service-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 0;
		border-bottom: 1px solid var(--border-light);
	}

	.service-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.service-name {
		font-weight: 500;
		font-size: 0.9rem;
	}

	.service-url {
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.service-actions {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.btn-add-existing, .btn-delete-svc {
		padding: 6px;
		border-radius: 4px;
		display: flex;
		border: 1px solid var(--border);
	}

	.btn-add-existing:hover {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.btn-delete-svc:hover {
		background: var(--danger);
		color: white;
		border-color: var(--danger);
	}

	.widget-options {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-bottom: 12px;
	}

	.widget-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		transition: all var(--transition);
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.widget-option:hover {
		border-color: var(--accent);
	}

	.widget-option.active {
		border-color: var(--accent);
		background: rgba(79, 143, 255, 0.1);
		color: var(--accent);
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

	.toggle-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.detect-status.no-sensors {
		color: var(--text-secondary);
		font-style: italic;
	}

	.sub-tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 16px;
		border-bottom: 1px solid var(--border);
	}

	.sub-tab {
		padding: 8px 16px;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
		border-bottom: 2px solid transparent;
		transition: all var(--transition);
	}

	.sub-tab.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.sub-tab:hover {
		color: var(--text-primary);
	}

	.integration-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 16px;
		margin-bottom: 16px;
	}

	.integration-header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: 14px;
	}

	.integration-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		background: rgba(79, 143, 255, 0.1);
		color: var(--accent);
		flex-shrink: 0;
	}

	.integration-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.integration-name {
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--text-primary);
	}

	.integration-desc {
		font-size: 0.8rem;
		color: var(--text-muted);
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

	.size-row {
		display: flex;
		gap: 12px;
	}

	.size-row .field {
		flex: 1;
	}

	.docker-icon {
		background: rgba(0, 150, 136, 0.1);
		color: #009688;
	}

	.env-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 10px;
	}

	.env-row {
		display: flex;
		align-items: flex-start;
		gap: 6px;
	}

	.env-fields {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}

	.env-name-input {
		width: 100%;
		padding: 6px 8px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.85rem;
	}

	.env-name-input:focus {
		border-color: var(--accent);
	}

	.env-url-input {
		width: 100%;
		padding: 6px 8px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.env-url-input:focus {
		border-color: var(--accent);
	}

	.btn-remove-env {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 4px;
		flex-shrink: 0;
		margin-top: 2px;
		color: var(--text-muted);
	}

	.btn-remove-env:hover {
		background: var(--danger);
		color: white;
	}

	.btn-add-env {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		transition: all var(--transition);
		width: 100%;
		margin-bottom: 10px;
	}

	.btn-add-env:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.service-grid {
		border-top: 1px solid var(--border);
		padding-top: 12px;
	}

	.service-grid h3 {
		font-size: 0.9rem;
		margin-bottom: 10px;
		color: var(--text-secondary);
	}

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
		background: rgba(128,128,128,0.12);
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

	@keyframes slideDown {
		from { opacity: 1; transform: translateY(0); }
		to { opacity: 0; transform: translateY(20px); }
	}
</style>