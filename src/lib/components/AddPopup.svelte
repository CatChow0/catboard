<script lang="ts">
	// "Add to dashboard": registered services (add/ServicesTab) and the widget
	// catalog (add/WidgetsTab). Connections live in Settings > Integrations.
	// Styles of the popup and both tabs: add/add.css.
	import { onMount } from 'svelte';
	import { loadIntegrations } from '$lib/stores/integrations';
	import ServicesTab from './add/ServicesTab.svelte';
	import WidgetsTab from './add/WidgetsTab.svelte';
	import './add/add.css';

	let { onclose }: { onclose: () => void } = $props();
	let closing = $state(false);
	let activeTab = $state<'services' | 'widgets'>('services');

	onMount(() => {
		loadIntegrations(true);
	});

	function close() {
		closing = true;
		setTimeout(() => onclose(), 180);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="popup-overlay cb-add" class:closing role="dialog" aria-modal="true" aria-label="Add to dashboard" tabindex="-1" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}>
	<div class="popup sheet-full" role="presentation" onclick={(e) => e.stopPropagation()}>
		<div class="popup-header">
			<h2>Add to dashboard</h2>
			<button class="btn-close" onclick={close} aria-label="Close">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="modal-body">
			<div class="sidebar">
				<button class="tab" class:active={activeTab === 'services'} onclick={() => (activeTab = 'services')}>Services</button>
				<button class="tab" class:active={activeTab === 'widgets'} onclick={() => (activeTab = 'widgets')}>Widgets</button>
			</div>

			{#if activeTab === 'services'}
				<ServicesTab />
			{:else}
				<WidgetsTab {close} />
			{/if}
		</div>
	</div>
</div>
