<script lang="ts">
	import { settings } from '$lib/stores/dashboard';
	import '$lib/components/theme.css';

	let { children } = $props();

	let customPaletteStyle = $derived(
		$settings.theme === 'custom' && $settings.customPalette
			? Object.entries($settings.customPalette)
					.map(([key, value]) => `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
					.join('; ') + ';'
			: ''
	);

	let bgStyle = $derived(
		$settings.background?.type === 'image' && $settings.background.value
			? `background-image: url('${$settings.background.value}'); background-size: cover; background-position: center; background-attachment: fixed;`
			: ''
	);

	let rootStyle = $derived([customPaletteStyle, bgStyle].filter(Boolean).join(' ') || undefined);
</script>

<div data-theme={$settings.theme === 'custom' ? 'dark' : $settings.theme} data-style={$settings.stylePreset || 'default'} data-animations={$settings.animations || 'subtle'} data-scrollbar={$settings.scrollbarStyle || 'thin'} style={rootStyle}>
	{@render children()}
</div>

<style>
	div {
		min-height: 100vh;
		background-color: var(--bg-primary);
		transition: background-color var(--transition);
	}
</style>