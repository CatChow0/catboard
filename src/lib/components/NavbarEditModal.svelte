<script lang="ts">
	// Edit modal of a navbar widget. The form and the widget catalog load only
	// when a widget is edited (see NavbarEditForm).
	import type { NavbarItem } from '$lib/types';

	let props: {
		item: NavbarItem;
		onclose: () => void;
		onpreview?: (iconScale: number, textScale: number) => void;
	} = $props();
</script>

{#await import('./NavbarEditForm.svelte') then m}
	<m.default {...props} />
{/await}
