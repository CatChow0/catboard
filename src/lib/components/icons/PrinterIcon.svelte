<script lang="ts">
	// Generic 3D printer glyph (frame, gantry, nozzle, bed). Coloured by currentColor.
	// size: pixels, or any CSS length (e.g. a calc() using the navbar --nb-icon scale).
	let { size = 14, label = '' }: { size?: number | string; label?: string } = $props();
	const len = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

<svg style="width: {len}; height: {len}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}>
	<rect x="3" y="2.5" width="18" height="19" rx="2" />
	<path d="M3 7.5h18" />
	<path d="M10 7.5v3h4v-3" />
	<path d="M12 10.5v1.5" />
	<path d="M7 18h10" />
	<path d="M9 18v-2.5h6V18" />
</svg>
