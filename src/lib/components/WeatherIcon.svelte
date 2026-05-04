<script lang="ts">
	let { code }: { code: number } = $props();

	const icon = $derived.by(() => {
		const map: Record<number, string> = {
			0: 'clear', 1: 'mainly-clear', 2: 'partly-cloudy', 3: 'overcast',
			45: 'fog', 48: 'fog',
			51: 'drizzle', 53: 'drizzle', 55: 'drizzle',
			56: 'drizzle', 57: 'drizzle',
			61: 'rain', 63: 'rain', 65: 'rain',
			66: 'rain', 67: 'rain',
			71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
			80: 'showers', 81: 'showers', 82: 'showers',
			85: 'snow', 86: 'snow',
			95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm'
		};
		return map[code] || 'clear';
	});
</script>

{#if icon === 'clear' || icon === 'mainly-clear'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		<circle cx="12" cy="12" r="5" />
		<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
	</svg>
{:else if icon === 'partly-cloudy'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		<circle cx="8" cy="8" r="3.5" />
		<path d="M8 1v1M8 13v1M1 8h1M13 8h1M3.5 3.5l.7.7M11.8 11.8l.7.7M3.5 12.5l.7-.7M11.8 4.2l.7-.7" />
		<path d="M10 14.5a3.5 3.5 0 1 0 0-3H7.5a3 3 0 0 0 0 6H17a2.5 2.5 0 0 0 0-5H16" />
	</svg>
{:else if icon === 'overcast'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
	</svg>
{:else if icon === 'fog'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		<path d="M3 15h18M3 19h18M8 11a4 4 0 1 0-3-5.3" />
	</svg>
{:else if icon === 'drizzle'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
		<path d="M8 19v2M12 19v2M16 19v2" />
	</svg>
{:else if icon === 'rain'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
		<path d="M8 19v2M12 19v2M16 19v2M10 22v1M14 22v1" />
	</svg>
{:else if icon === 'snow'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
		<path d="M9 20l-1 1M12 20v2M15 20l1 1" />
	</svg>
{:else if icon === 'showers'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		<path d="M16 13a4 4 0 0 0-8 0M12 1v2M4.22 4.22l1.42 1.42M1 12h2M18 12h2M4.22 19.78l1.42-1.42" />
		<path d="M9 17v2M12 17v3M15 17v2" />
	</svg>
{:else if icon === 'thunderstorm'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
		<path d="M13 16l-2 4h3l-2 4" />
	</svg>
{:else}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
		<circle cx="12" cy="12" r="5" />
		<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2" />
	</svg>
{/if}
