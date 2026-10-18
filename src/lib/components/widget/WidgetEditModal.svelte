<script lang="ts">
	// Edit modal of a dashboard widget. The form, the widget catalog and every
	// settings form load only when a widget is edited (see WidgetEditForm).
	let props: {
		type: string;
		itemid: string;
		config?: object;
		onclose: () => void;
		onsaved?: () => void;
	} = $props();
</script>

{#await import('./WidgetEditForm.svelte') then m}
	<m.default {...props} />
{/await}
