<script lang="ts">
	// Settings > Export: full export, backups, and import of chosen sections.
	// Styles: settings.css.
	import type { Layout } from '$lib/types';
	import { exportDashboard, importDashboard } from '$lib/stores/dashboard';
	import BackupsPanel from './BackupsPanel.svelte';

	/** After an import: the imported settings are the new look, the modal closes keeping them. */
	let { onimported }: { onimported: () => void } = $props();

	/** An export file (GET /api/export), as far as the summary reads it. */
	interface ExportFile {
		exportedAt?: string;
		services?: { services?: unknown[] };
		layout?: Partial<Layout>;
		settings?: unknown;
		integrations?: unknown;
		[key: string]: unknown;
	}

	let importData = $state<ExportFile | null>(null);
	let importSections = $state<string[]>([]);
	let importing = $state(false);
	let exporting = $state(false);

	/** Dashboards and tiles in an exported layout (every dashboard, widest breakpoint). */
	function layoutSummary(l: Partial<Layout> | undefined): string {
		const pages = [l?.layouts, ...Object.values(l?.pages ?? {})].filter(Boolean) as Record<string, { items?: unknown[] }>[];
		const items = pages.reduce((n, p) => n + Math.max(0, ...Object.values(p).map((bp) => bp.items?.length ?? 0)), 0);
		return `${pages.length} dashboard${pages.length === 1 ? '' : 's'}, ${items} item${items === 1 ? '' : 's'}`;
	}

	async function handleExport() {
		exporting = true;
		try {
			const url = URL.createObjectURL(await exportDashboard());
			const a = document.createElement('a');
			a.href = url;
			a.download = `catboard-export-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			// nothing to download
		}
		exporting = false;
	}

	async function handleImportFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			importData = JSON.parse(await file.text());
			importSections = [];
		} catch {
			importData = null;
		}
	}

	function toggleImportSection(section: string) {
		importSections = importSections.includes(section) ? importSections.filter((s) => s !== section) : [...importSections, section];
	}

	async function handleImport() {
		if (!importData || importSections.length === 0) return;
		importing = true;
		try {
			await importDashboard(importData, importSections);
			importData = null;
			importSections = [];
			onimported();
		} catch {
			// the file stays selected to try again
		}
		importing = false;
	}

	const sections = $derived(
		importData
			? [
					importData.services && { id: 'services', label: 'Services', count: `${Array.isArray(importData.services.services) ? importData.services.services.length : 0} services` },
					importData.layout && { id: 'layout', label: 'Layout', count: layoutSummary(importData.layout) },
					importData.settings && { id: 'settings', label: 'Settings', count: 'Theme & preferences' },
					importData.integrations && { id: 'integrations', label: 'Integrations', count: 'External connections' }
				].filter((s): s is { id: string; label: string; count: string } => !!s)
			: []
	);
</script>

<div class="settings-section">
	<h3>Export</h3>
	<p class="export-desc">Download a complete backup of your dashboard configuration, including services, layout, settings, and integrations.</p>
	<button class="btn-export" onclick={handleExport} disabled={exporting}>{exporting ? 'Exporting...' : 'Export Dashboard'}</button>
</div>

<BackupsPanel />

<div class="settings-section">
	<h3>Import</h3>
	{#if !importData}
		<label class="import-file-area">
			<input type="file" accept=".json" onchange={handleImportFile} />
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</svg>
			<span>Select export file</span>
		</label>
	{:else}
		<div class="import-summary">
			<p class="import-file-name">{importData.exportedAt ? `Export from ${importData.exportedAt.slice(0, 10)}` : 'Export file loaded'}</p>
			<div class="import-sections">
				{#each sections as s (s.id)}
					<label class="section-check">
						<input type="checkbox" checked={importSections.includes(s.id)} onchange={() => toggleImportSection(s.id)} />
						<span>{s.label}</span>
						<span class="section-count">{s.count}</span>
					</label>
				{/each}
			</div>
		</div>
		<p class="import-warning">Importing replaces the selected sections. The current configuration is backed up first (see Backups above).</p>
		<div class="import-actions">
			<button class="btn-cancel" onclick={() => { importData = null; importSections = []; }}>Cancel</button>
			<button class="btn-import" onclick={handleImport} disabled={importSections.length === 0 || importing}>{importing ? 'Importing...' : 'Import Selected'}</button>
		</div>
	{/if}
</div>
