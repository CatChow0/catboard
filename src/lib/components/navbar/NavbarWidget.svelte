<script lang="ts">
	// Renders one navbar item by type. Shared by the desktop navbar grid and the
	// phone widget strip.
	import type { NavbarItem } from '$lib/types';
	import NavbarTitle from './NavbarTitle.svelte';
	import NavbarSearch from './NavbarSearch.svelte';
	import NavbarCpuWidget from './NavbarCpuWidget.svelte';
	import NavbarRamWidget from './NavbarRamWidget.svelte';
	import NavbarDiskWidget from './NavbarDiskWidget.svelte';
	import NavbarUptimeKumaStatusPage from './NavbarUptimeKumaStatusPage.svelte';
	import NavbarDocker from './NavbarDocker.svelte';
	import NavbarElegooPrint from './NavbarElegooPrint.svelte';
	import NavbarAdGuardControl from './NavbarAdGuardControl.svelte';
	import NavbarClock from './NavbarClock.svelte';
	import NavbarWeather from './NavbarWeather.svelte';

	let { item, colSpan, onsearch }: {
		item: NavbarItem;
		/** Span to render with (differs from item.colSpan while resizing). */
		colSpan: number;
		onsearch?: (query: string, isEnter: boolean) => void;
	} = $props();
</script>

{#if item.type === 'navbar-title'}
	<NavbarTitle />
{:else if item.type === 'navbar-search'}
	<NavbarSearch placeholder={item.placeholder} {onsearch} />
{:else if item.type === 'navbar-cpu'}
	<NavbarCpuWidget {colSpan} config={item.config} />
{:else if item.type === 'navbar-ram'}
	<NavbarRamWidget {colSpan} />
{:else if item.type === 'navbar-disk'}
	<NavbarDiskWidget config={item.config} {colSpan} />
{:else if item.type === 'navbar-uptime-kuma-status-page'}
	<NavbarUptimeKumaStatusPage config={item.config} {colSpan} />
{:else if item.type === 'navbar-docker'}
	<NavbarDocker config={item.config} {colSpan} />
{:else if item.type === 'navbar-adguard-home-control'}
	<NavbarAdGuardControl config={item.config} />
{:else if item.type === 'navbar-clock'}
	<NavbarClock config={item.config} {colSpan} />
{:else if item.type === 'navbar-weather'}
	<NavbarWeather config={item.config} {colSpan} />
{:else if item.type === 'navbar-elegoo-print'}
	<NavbarElegooPrint config={item.config} {colSpan} />
{/if}
