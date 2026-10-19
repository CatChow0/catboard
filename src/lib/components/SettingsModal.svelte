<script lang="ts">
	// Settings: tabs on the left, the chosen tab on the right. Appearance and
	// Layout edit drafts that are previewed live and saved together by Save;
	// Cancel puts the previous look and layout back. Integrations, Admin and
	// Export act on their own. Styles of the modal and every tab: settings.css.
	import { t } from '$lib/i18n';
	import { untrack } from 'svelte';
	import { settings, layout, saveSettings, currentUser, refreshActiveDashboard } from '$lib/stores/dashboard';
	import AdminPanel from './AdminPanel.svelte';
	import IntegrationsPanel from './settings/IntegrationsPanel.svelte';
	import AppearanceTab from './settings/AppearanceTab.svelte';
	import LayoutTab from './settings/LayoutTab.svelte';
	import CacheTab from './settings/CacheTab.svelte';
	import ExportTab from './settings/ExportTab.svelte';
	import { AppearanceDraft } from './settings/appearance-draft.svelte';
	import { LayoutDraft } from './settings/layout-draft.svelte';
	import './settings/settings.css';

	let { onclose, initialTab, initialIntegration }: {
		onclose: () => void;
		/** Tab to open on (e.g. the widget catalog's "Set up" links). */
		initialTab?: 'integrations';
		initialIntegration?: string;
	} = $props();

	type Tab = 'appearance' | 'layout' | 'integrations' | 'cache' | 'admin' | 'export';
	let activeTab = $state<Tab>(untrack(() => initialTab) ?? 'appearance');
	let closing = $state(false);
	let saved = false;

	const appearance = new AppearanceDraft($settings);
	const layoutDraft = new LayoutDraft($settings);
	const originalSettings = $state.snapshot($settings);

	// Every appearance change shows at once.
	$effect(() => {
		const next = appearance.values();
		untrack(() => settings.update((s) => ({ ...s, ...next })));
	});

	const showAdmin = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');
	const tabs = $derived<[Tab, string][]>([
		['appearance', $t('settings.tabAppearance')],
		['layout', $t('settings.tabLayout')],
		['integrations', $t('settings.tabIntegrations')],
		['cache', $t('settings.tabCache')],
		...(showAdmin ? ([['admin', $t('settings.tabAdmin')], ['export', $t('settings.tabExport')]] as [Tab, string][]) : [])
	]);

	async function saveAll() {
		const data: Record<string, unknown> = { ...$settings, ...appearance.values(), ...layoutDraft.values() };
		// Unset options are left out of the file rather than stored as null.
		for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
		await saveSettings(data as never);
		await layoutDraft.saveEdits();
		saved = true;
		await refreshActiveDashboard();
		close();
	}

	function close() {
		// Closing without saving: drop the live preview.
		if (!saved && layoutDraft.pendingCount) layout.set(layoutDraft.originalLayout);
		if (!saved) settings.set(originalSettings);
		closing = true;
		setTimeout(() => onclose(), $settings.animations === 'none' ? 0 : 200);
	}
</script>

<div class="modal-overlay cb-settings" class:closing>
	<div class="modal sheet-full" class:closing>
		<div class="modal-header">
			<h2>{$t('settings.title')}</h2>
			<button class="btn-close" onclick={close} title={$t('common.close')}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="modal-body">
			<div class="sidebar">
				{#each tabs as [id, label] (id)}
					<button class="tab" class:active={activeTab === id} onclick={() => (activeTab = id)}>{label}</button>
				{/each}
			</div>

			<div class="tab-content" class:flush={activeTab === 'integrations'}>
				{#if activeTab === 'appearance'}
					<AppearanceTab draft={appearance} />
				{:else if activeTab === 'layout'}
					<LayoutTab draft={layoutDraft} />
				{:else if activeTab === 'integrations'}
					<IntegrationsPanel initial={initialIntegration} />
				{:else if activeTab === 'cache'}
					<CacheTab />
				{:else if activeTab === 'admin'}
					<AdminPanel />
				{:else if activeTab === 'export'}
					<ExportTab
						onimported={() => {
							saved = true;
							close();
						}}
					/>
				{/if}
			</div>
		</div>

		<!-- Export and Integrations act on their own (each connection has its Save button). -->
		{#if activeTab !== 'export' && activeTab !== 'integrations'}
			<div class="modal-footer">
				<button class="btn-cancel" onclick={close}>{$t('common.cancel')}</button>
				<button class="btn-save" onclick={saveAll}>{$t('common.save')}</button>
			</div>
		{/if}
	</div>
</div>
