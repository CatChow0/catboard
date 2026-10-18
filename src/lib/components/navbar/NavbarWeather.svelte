<script lang="ts">
	import { whileVisible } from '$lib/utils/poll';
	// Navbar weather: icon, temperature and (when wide enough) the city.
	// Polls /api/weather like the standard Weather widget (server caches 10 min).
	import type { WeatherConfig } from '$lib/types';
	import WeatherIcon from '../WeatherIcon.svelte';

	let { colSpan = 2, config }: { colSpan?: number; config?: WeatherConfig } = $props();

	const location = $derived(config?.location ?? null);
	const showCity = $derived(colSpan >= 2);

	let temperature = $state<number | null>(null);
	let weatherCode = $state(0);

	$effect(() => {
		const loc = location;
		temperature = null;
		if (!loc) return;

		let controller: AbortController | null = null;
		async function load() {
			controller?.abort();
			controller = new AbortController();
			try {
				const res = await fetch(`/api/weather?lat=${loc!.latitude}&lon=${loc!.longitude}`, { signal: controller.signal });
				const data = await res.json();
				if (data.temperature != null) {
					temperature = data.temperature;
					weatherCode = data.weatherCode;
				}
			} catch {
				// keep the last value; retried on the next tick
			}
		}
		load();
		const stop = whileVisible(load, 600_000);
		return () => {
			stop();
			controller?.abort();
		};
	});
</script>

<div class="nb-weather" title={location ? location.name : 'No location set'}>
	{#if !location}
		<span class="nb-muted">Set location</span>
	{:else}
		<span class="nb-icon"><WeatherIcon code={weatherCode} /></span>
		<span class="nb-temp">{temperature != null ? `${Math.round(temperature)}°` : '--'}</span>
		{#if showCity}
			<span class="nb-city">{location.name}</span>
		{/if}
	{/if}
</div>

<style>
	.nb-weather {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 8px;
		height: 100%;
		white-space: nowrap;
		overflow: hidden;
	}

	.nb-icon {
		display: flex;
		flex-shrink: 0;
		color: var(--accent);
	}

	.nb-icon > :global(svg) {
		width: calc(18px * var(--nb-icon, 1));
		height: calc(18px * var(--nb-icon, 1));
	}

	.nb-temp {
		font-size: calc(0.85rem * var(--nb-text, 1));
		font-weight: 600;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.nb-city {
		font-size: calc(0.75rem * var(--nb-text, 1));
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.nb-muted {
		font-size: calc(0.75rem * var(--nb-text, 1));
		color: var(--text-muted);
	}
</style>
