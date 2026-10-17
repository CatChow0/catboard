<script lang="ts">
	import { GLYPHS, type GlyphName } from './glyphs';

	let { name, size = 22 }: { name: GlyphName; size?: number } = $props();
	const def = $derived(GLYPHS[name]);
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill={'fill' in def && def.fill ? 'currentColor' : 'none'} stroke={'fill' in def && def.fill ? 'none' : 'currentColor'} stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<!-- Static markup from glyphs.ts -->
	{@html def.svg}
</svg>
