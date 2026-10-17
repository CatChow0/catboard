<script lang="ts">
	import type { WeatherConfig } from '$lib/types';
	import { isEditing } from '$lib/stores/dashboard';
	import WeatherIcon from './WeatherIcon.svelte';
	import WidgetEditModal from './widget/WidgetEditModal.svelte';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: WeatherConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	let showEditModal = $state(false);
	const selectedLocation = $derived(config?.location || null);

	let temperature = $state<number | null>(null);
	let weatherCode = $state(0);
	let loading = $state(true);

	const cells = $derived(colSpan * rowSpan);
	const showIcon = $derived(cells >= 2);
	const showLocation = $derived(cells >= 4);

	// Fetched when the location changes, then every 10 minutes.
	$effect(() => {
		const loc = selectedLocation;
		if (!loc) {
			loading = false;
			return;
		}
		const controller = new AbortController();
		async function fetchWeather() {
			loading = true;
			try {
				const res = await fetch(`/api/weather?lat=${loc!.latitude}&lon=${loc!.longitude}`, { signal: controller.signal });
				const data = await res.json();
				if (controller.signal.aborted) return;
				if (data.temperature != null) {
					temperature = data.temperature;
					weatherCode = data.weatherCode;
				}
			} catch {
				// silent fail
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}
		fetchWeather();
		const interval = setInterval(fetchWeather, 600_000);
		return () => {
			clearInterval(interval);
			controller.abort();
		};
	});
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
		<button class="btn-edit" onclick={(e) => { e.stopPropagation(); showEditModal = true; }} onpointerdown={(e) => e.stopPropagation()} title="Edit weather">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		</button>
	{/if}
</div>

{#if showEditModal}
	<WidgetEditModal type="weather" {itemid} {config} onclose={() => (showEditModal = false)} />
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
</style>
