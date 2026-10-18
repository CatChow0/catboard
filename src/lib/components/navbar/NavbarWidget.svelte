<script lang="ts">
	// Renders one navbar item by type. Shared by the desktop navbar grid and the
	// phone widget strip. Title and search are always there; the other widgets'
	// code is loaded on demand.
	import type { NavbarItem } from '$lib/types';
	import NavbarTitle from './NavbarTitle.svelte';
	import NavbarSearch from './NavbarSearch.svelte';
	import LazyWidget from '../widget/LazyWidget.svelte';
	import { NAVBAR_WIDGETS } from '$lib/widgets/loaders';

	let { item, colSpan, onsearch }: {
		item: NavbarItem;
		/** Span to render with (differs from item.colSpan while resizing). */
		colSpan: number;
		onsearch?: (query: string, isEnter: boolean) => void;
	} = $props();

	let loader = $derived(NAVBAR_WIDGETS[item.type]);
	let widgetProps = $derived({ config: 'config' in item ? item.config : undefined, colSpan });
</script>

{#if item.type === 'navbar-title'}
	<NavbarTitle />
{:else if item.type === 'navbar-search'}
	<NavbarSearch placeholder={item.placeholder} {onsearch} />
{:else if loader}
	<LazyWidget {loader} props={widgetProps} inline />
{/if}
