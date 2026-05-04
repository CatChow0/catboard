<script lang="ts">
	import type { WeatherConfig } from '$lib/types';
	import { isEditing } from '$lib/stores/dashboard';
	import { updateDashboardItem } from '$lib/stores/dashboard';
	import { onMount } from 'svelte';
	import WeatherIcon from './WeatherIcon.svelte';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: WeatherConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	let showEditModal = $state(false);
	let closing = $state(false);
	let searchQuery = $state('');
	let searchResults = $state<{ name: string; latitude: number; longitude: number; country: string; zipcode: string; admin1: string }[]>([]);
	let searchLoading = $state(false);
	let selectedLocation = $state(config?.location || null);

	let temperature = $state<number | null>(null);
	let weatherCode = $state(0);
	let loading = $state(true);
	let fetchController: AbortController | null = null;

	const cells = $derived(colSpan * rowSpan);
	const showIcon = $derived(cells >= 2);
	const showLocation = $derived(cells >= 4);

	onMount(() => {
		fetchWeather();
	});

	async function fetchWeather() {
		if (!selectedLocation) {
			loading = false;
			return;
		}
		fetchController?.abort();
		const controller = new AbortController();
		fetchController = controller;
		loading = true;
		try {
			const res = await fetch(`/api/weather?lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}`, {
				signal: controller.signal
			});
			const data = await res.json();
			if (controller.signal.aborted) return;
			if (data.temperature != null) {
				temperature = data.temperature;
				weatherCode = data.weatherCode;
			}
		} catch {
			// silent fail
		} finally {
			if (fetchController === controller) {
				fetchController = null;
				loading = false;
			}
		}
	}

	$effect(() => {
		const interval = setInterval(fetchWeather, 600_000);
		return () => {
			clearInterval(interval);
			fetchController?.abort();
		};
	});

	async function searchLocation() {
		if (!searchQuery.trim()) return;
		searchLoading = true;
		try {
			const res = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery.trim())}`);
			const data = await res.json();
			searchResults = data.results || [];
		} catch { searchResults = []; }
		searchLoading = false;
	}

	function selectLocation(loc: typeof searchResults[0]) {
		selectedLocation = { name: loc.name, latitude: loc.latitude, longitude: loc.longitude, zipcode: loc.zipcode, country: loc.country };
		searchQuery = '';
		searchResults = [];
	}

	function openEditModal() {
		closing = false;
		searchQuery = '';
		searchResults = [];
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
			config: { location: selectedLocation || undefined }
		} as any);
		fetchWeather();
	}
</script>

<div class="weather-tile">
	{#if !selectedLocation && !loading}
		<div class="weather-placeholder">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
				<circle cx="12" cy="12" r="4" />
			</svg>
			<span>No location set</span>
		</div>
	{:else if loading && temperature === null}
		<div class="weather-loading">...</div>
	{:else}
		<div class="weather-content">
			{#if showIcon}
				<div class="weather-icon">
					<WeatherIcon code={weatherCode} />
				</div>
			{/if}
			<div class="weather-info">
				<div class="weather-temp">{temperature != null ? `${Math.round(temperature)}°` : '--'}</div>
				{#if showLocation && selectedLocation}
					<div class="weather-location">{selectedLocation.name}{selectedLocation.zipcode ? ` ${selectedLocation.zipcode}` : ''}</div>
				{/if}
			</div>
		</div>
	{/if}
	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title="Remove weather">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); openEditModal(); }} onpointerdown={(e) => e.stopPropagation()} title="Edit weather">
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
				<h2>Edit Weather</h2>
				<button class="btn-close" onclick={closeModal}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="modal-body">
				<div class="field">
					<label>Location</label>
					<div class="search-row">
						<input type="text" bind:value={searchQuery} placeholder="Search city..." onkeydown={(e) => e.key === 'Enter' && searchLocation()} />
						<button class="btn-search" onclick={searchLocation} disabled={searchLoading}>
							{searchLoading ? '...' : 'Search'}
						</button>
					</div>
					{#if searchResults.length > 0}
						<div class="search-results">
							{#each searchResults as result}
								<button class="result-item" onclick={() => selectLocation(result)}>
									<span class="result-name">{result.name}</span>
									<span class="result-detail">{result.admin1}{result.admin1 && result.country ? ', ' : ''}{result.country}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
				{#if selectedLocation}
					<div class="current-location">
						<span class="location-label">{selectedLocation.name}{selectedLocation.zipcode ? ` ${selectedLocation.zipcode}` : ''}</span>
						<button class="btn-clear" onclick={() => (selectedLocation = null)}>Clear</button>
					</div>
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
	.weather-tile {
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

	.weather-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 0.75rem;
		padding: 12px;
	}

	.weather-loading {
		font-size: 1.2rem;
		color: var(--text-muted);
	}

	.weather-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		width: 100%;
		min-width: 0;
	}

	.weather-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.weather-icon > :global(svg) {
		width: 28px;
		height: 28px;
		color: var(--accent);
	}

	.weather-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.weather-temp {
		font-weight: 700;
		color: var(--text-primary);
		font-size: 1.1rem;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
		white-space: nowrap;
	}

	.weather-location {
		font-size: 0.7rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
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

	.weather-tile:hover .btn-delete,
	.weather-tile:hover .btn-edit {
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

	.search-row {
		display: flex;
		gap: 6px;
	}

	.search-row input {
		flex: 1;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.search-row input:focus {
		border-color: var(--accent);
	}

	.btn-search {
		padding: 8px 14px;
		background: var(--accent);
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.btn-search:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-search:disabled {
		opacity: 0.5;
	}

	.search-results {
		margin-top: 6px;
		max-height: 160px;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	.result-item {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 8px 10px;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border-light);
		text-align: left;
		cursor: pointer;
		transition: background var(--transition);
	}

	.result-item:last-child {
		border-bottom: none;
	}

	.result-item:hover {
		background: var(--bg-card-hover);
	}

	.result-name {
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.result-detail {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.current-location {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		margin-bottom: 10px;
	}

	.location-label {
		font-size: 0.85rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.btn-clear {
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.btn-clear:hover {
		border-color: var(--danger);
		color: var(--danger);
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
