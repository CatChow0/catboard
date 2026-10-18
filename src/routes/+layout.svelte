<script lang="ts">
	import { settings } from '$lib/stores/dashboard';
	import { effectiveTheme, appearanceStyle, fontHref, isFontName, MAX_CUSTOM_CSS } from '$lib/themes';
	import '$lib/components/theme.css';

	let { children } = $props();

	// Theme 'auto' follows the system colour scheme, live.
	let prefersDark = $state(true);
	$effect(() => {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		prefersDark = mq.matches;
		const onChange = () => (prefersDark = mq.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	let theme = $derived(effectiveTheme($settings, prefersDark));

	let bgStyle = $derived(
		$settings.background?.type === 'image' && $settings.background.value
			? `background-image: url('${$settings.background.value}'); background-size: cover; background-position: center; background-attachment: fixed;`
			: ''
	);

	let rootStyle = $derived([appearanceStyle($settings, theme), bgStyle].filter(Boolean).join('; ') || undefined);
	let font = $derived($settings.font && isFontName($settings.font) ? $settings.font : '');

	// Text size scales every rem.
	$effect(() => {
		const scale = Math.max(90, Math.min(120, $settings.fontScale ?? 100));
		document.documentElement.style.fontSize = scale === 100 ? '' : `${scale}%`;
	});

	// The user's own CSS goes after the theme. textContent keeps it plain CSS;
	// ?nocss in the URL skips it to recover from a broken stylesheet.
	$effect(() => {
		const css = new URLSearchParams(location.search).has('nocss') ? '' : ($settings.customCss ?? '').slice(0, MAX_CUSTOM_CSS);
		let el = document.getElementById('cb-custom-css');
		if (!css) {
			el?.remove();
			return;
		}
		if (!el) {
			el = document.createElement('style');
			el.id = 'cb-custom-css';
			document.head.appendChild(el);
		}
		el.textContent = css;
	});
</script>

<svelte:head>
	{#if font}
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
		<link rel="stylesheet" href={fontHref(font)} />
	{/if}
</svelte:head>

<div class="cb-root" data-theme={theme === 'custom' ? 'dark' : theme} data-style={$settings.stylePreset || 'default'} data-animations={$settings.animations || 'subtle'} data-scrollbar={$settings.scrollbarStyle || 'thin'} data-glass={($settings.cardBlur ?? 0) > 0 ? '' : undefined} style={rootStyle}>
	{@render children()}
</div>

<style>
	div {
		min-height: 100vh;
		background-color: var(--bg-primary);
		/* Text inherits the theme's colour (body sits outside the themed root). */
		color: var(--text-primary);
		transition: background-color var(--transition);
	}
</style>
