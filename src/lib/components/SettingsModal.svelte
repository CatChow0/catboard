<script lang="ts">
	import { settings, layout, activeBreakpointId, saveSettings, saveNavbarLayout, currentUser, exportDashboard, importDashboard } from '$lib/stores/dashboard';
	import { themePresets, customPaletteDefaults, themeDefaults } from '$lib/themes';
	import type { CustomPalette } from '$lib/stores/dashboard';
	import AdminPanel from './AdminPanel.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let activeTab = $state<'appearance' | 'layout' | 'cache' | 'admin' | 'export'>('appearance');
	let closing = $state(false);

	let title = $state($settings.title);
	let cellSize = $state($settings.layout?.cellSize || 80);
	let gap = $state($settings.layout?.gap || 12);
	let breakpoints = $state([...($settings.layout?.breakpoints || [{ id: 'mobile', name: 'Mobile', minWidth: 0, columns: 4 }, { id: 'tablet', name: 'Tablet', minWidth: 800, columns: 6 }, { id: 'desktop', name: 'Desktop', minWidth: 1200, columns: 10 }])].map((bp, i) => bp.id ? bp : { ...bp, id: `bp-${bp.minWidth}-${i}` }));
	let selectedTheme = $state($settings.theme);
	let bgType = $state($settings.background?.type || 'none');
	let bgValue = $state($settings.background?.value || '');
	let stylePreset = $state($settings.stylePreset || 'default');
	let animations = $state($settings.animations || 'subtle');
	let scrollbarStyle = $state($settings.scrollbarStyle || 'thin');
	let navbarColumns = $state($settings.navbar?.columns || 12);
	let customPalette = $state<CustomPalette>(
		$settings.customPalette || { ...customPaletteDefaults['dark'] }
	);

	const paletteLabels: Record<keyof CustomPalette, string> = {
		bgPrimary: 'Background',
		bgSecondary: 'Secondary BG',
		bgCard: 'Card BG',
		bgCardHover: 'Card Hover',
		bgModal: 'Modal BG',
		textPrimary: 'Text Primary',
		textSecondary: 'Text Secondary',
		textMuted: 'Text Muted',
		accent: 'Accent',
		accentHover: 'Accent Hover',
		danger: 'Danger',
		success: 'Success',
		warning: 'Warning',
		border: 'Border Light',
		borderLight: 'Border Light'
	};

	function addBreakpoint() {
		breakpoints = [...breakpoints, { id: crypto.randomUUID(), name: 'New Layout', minWidth: 0, columns: 4 }];
	}

	function removeBreakpoint(index: number) {
		if (breakpoints.length <= 1) return;
		breakpoints = breakpoints.filter((_, i) => i !== index);
	}

	function applyTheme(themeName: string) {
		if (themeName === 'custom') {
			const baseTheme = selectedTheme === 'custom' ? 'dark' : selectedTheme;
			customPalette = { ...customPaletteDefaults[baseTheme] || customPaletteDefaults['dark'] };
		} else {
			const defaults = themeDefaults[themeName];
			if (defaults) {
				stylePreset = defaults.stylePreset;
				scrollbarStyle = defaults.scrollbarStyle;
			}
		}
		selectedTheme = themeName;
		settings.update(s => ({ ...s, theme: themeName, stylePreset, scrollbarStyle }));
	}

	function resetPalette() {
		const base = customPaletteDefaults[selectedTheme] ? selectedTheme : 'dark';
		customPalette = { ...customPaletteDefaults[base] };
	}

	async function saveAll() {
		const data: any = {
			...$settings,
			title,
			theme: selectedTheme,
			background: { type: bgType, value: bgValue },
			stylePreset,
			animations,
			scrollbarStyle,
			navbar: { columns: navbarColumns },
			layout: { cellSize, gap, breakpoints }
		};
		if (selectedTheme === 'custom') {
			data.customPalette = customPalette;
		} else {
			delete data.customPalette;
		}
		await saveSettings(data);
		const activeNavbar = $layout?.layouts?.[$activeBreakpointId]?.navbar;
		if (activeNavbar) {
			await saveNavbarLayout({ ...activeNavbar, columns: navbarColumns });
		}
		close();
	}

	function close() {
		closing = true;
		const duration = $settings.animations === 'none' ? 0 : 200;
		setTimeout(() => onclose(), duration);
	}

	let showAdmin = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');

	let cacheCount = $state(0);
	let cacheSize = $state(0);
	let cacheClearing = $state(false);
	let cacheRebuilding = $state(false);
	let cacheRebuildResult = $state<{ rebuilt: number; errors: string[] } | null>(null);

	async function loadCacheStats() {
		try {
			const res = await fetch('/api/cache');
			const data = await res.json();
			cacheCount = data.count;
			cacheSize = data.size;
		} catch {}
	}

	async function clearIconCache() {
		cacheClearing = true;
		cacheRebuildResult = null;
		try {
			await fetch('/api/cache', { method: 'DELETE' });
			cacheCount = 0;
			cacheSize = 0;
		} catch {}
		cacheClearing = false;
	}

	async function rebuildIconCache() {
		cacheRebuilding = true;
		cacheRebuildResult = null;
		try {
			const res = await fetch('/api/cache', { method: 'POST' });
			const data = await res.json();
			cacheRebuildResult = data;
			await loadCacheStats();
		} catch {}
		cacheRebuilding = false;
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
	}

	let importData = $state<Record<string, unknown> | null>(null);
	let importSections = $state<string[]>([]);
	let importing = $state(false);
	let exporting = $state(false);

	async function handleExport() {
		exporting = true;
		try {
			const blob = await exportDashboard();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `catboard-export-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			// ignore
		}
		exporting = false;
	}

	function handleImportFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				importData = JSON.parse(reader.result as string);
				importSections = [];
			} catch {
				importData = null;
			}
		};
		reader.readAsText(file);
	}

	function toggleImportSection(section: string) {
		if (importSections.includes(section)) {
			importSections = importSections.filter(s => s !== section);
		} else {
			importSections = [...importSections, section];
		}
	}

	async function handleImport() {
		if (!importData || importSections.length === 0) return;
		importing = true;
		try {
			await importDashboard(importData, importSections);
			importData = null;
			importSections = [];
			close();
		} catch {
			// ignore
		}
		importing = false;
	}

	$effect(() => {
		if (activeTab === 'cache') loadCacheStats();
	});
</script>

<div class="modal-overlay" class:closing>
	<div class="modal" class:closing>
		<div class="modal-header">
			<h2>Settings</h2>
			<button class="btn-close" onclick={close} title="Close">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="modal-body">
			<div class="sidebar">
				<button class="tab" class:active={activeTab === 'appearance'} onclick={() => (activeTab = 'appearance')}>Appearance</button>
				<button class="tab" class:active={activeTab === 'layout'} onclick={() => (activeTab = 'layout')}>Layout</button>
				<button class="tab" class:active={activeTab === 'cache'} onclick={() => (activeTab = 'cache')}>Cache</button>
				{#if showAdmin}
					<button class="tab" class:active={activeTab === 'admin'} onclick={() => (activeTab = 'admin')}>Admin</button>
					<button class="tab" class:active={activeTab === 'export'} onclick={() => (activeTab = 'export')}>Export</button>
				{/if}
			</div>

			<div class="tab-content">
			{#if activeTab === 'appearance'}
				<div class="settings-section">
					<h3>Color Theme</h3>
					<div class="theme-grid">
						{#each themePresets as preset}
							<button
								class="theme-card"
								class:active={selectedTheme === preset.name}
								onclick={() => applyTheme(preset.name)}
							>
								<div class="theme-preview" data-theme-preview={preset.name}>
									<span class="theme-label">{preset.label}</span>
								</div>
							</button>
						{/each}
						<button
							class="theme-card"
							class:active={selectedTheme === 'custom'}
							onclick={() => applyTheme('custom')}
						>
							<div class="theme-preview custom-preview">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10" />
									<path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" opacity="0.3" />
								</svg>
								<span class="theme-label">Custom</span>
							</div>
						</button>
					</div>
				</div>

				{#if selectedTheme === 'custom'}
					<div class="settings-section">
						<div class="section-header">
							<h3>Custom Palette</h3>
							<button class="btn-reset" onclick={resetPalette}>Reset</button>
						</div>
						<div class="palette-grid">
							{#each Object.entries(paletteLabels) as [key, label]}
								<div class="palette-row">
									<label>{label}</label>
									<input type="color" bind:value={customPalette[key as keyof CustomPalette]} />
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="settings-section">
					<h3>Style</h3>
					<div class="option-cards">
						<button class="option-card" class:active={stylePreset === 'default'} onclick={() => (stylePreset = 'default')}>
							<div class="option-preview">
								<div class="style-box default-box"></div>
							</div>
							<span>Rounded</span>
						</button>
						<button class="option-card" class:active={stylePreset === 'sharp'} onclick={() => (stylePreset = 'sharp')}>
							<div class="option-preview">
								<div class="style-box sharp-box"></div>
							</div>
							<span>Sharp</span>
						</button>
						<button class="option-card" class:active={stylePreset === 'pill'} onclick={() => (stylePreset = 'pill')}>
							<div class="option-preview">
								<div class="style-box pill-box"></div>
							</div>
							<span>Pill</span>
						</button>
					</div>
				</div>

				<div class="settings-section">
					<h3>Animations</h3>
					<div class="option-cards">
						<button class="option-card" class:active={animations === 'none'} onclick={() => (animations = 'none')}>
							<div class="anim-preview">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10" />
									<line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
								</svg>
							</div>
							<span>None</span>
						</button>
						<button class="option-card" class:active={animations === 'subtle'} onclick={() => (animations = 'subtle')}>
							<div class="anim-preview">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
								</svg>
							</div>
							<span>Subtle</span>
						</button>
						<button class="option-card" class:active={animations === 'full'} onclick={() => (animations = 'full')}>
							<div class="anim-preview">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
								</svg>
							</div>
							<span>Full</span>
						</button>
					</div>
				</div>

				<div class="settings-section">
					<h3>Scrollbar</h3>
					<div class="option-cards">
						<button class="option-card" class:active={scrollbarStyle === 'thin'} onclick={() => (scrollbarStyle = 'thin')}>
							<div class="scroll-preview thin-scroll"></div>
							<span>Thin</span>
						</button>
						<button class="option-card" class:active={scrollbarStyle === 'wide'} onclick={() => (scrollbarStyle = 'wide')}>
							<div class="scroll-preview wide-scroll"></div>
							<span>Wide</span>
						</button>
						<button class="option-card" class:active={scrollbarStyle === 'hidden'} onclick={() => (scrollbarStyle = 'hidden')}>
							<div class="scroll-preview hidden-scroll"></div>
							<span>Hidden</span>
						</button>
					</div>
				</div>

				<div class="settings-section">
					<h3>Background</h3>
					<div class="field-row">
						<label>Type</label>
						<select bind:value={bgType}>
							<option value="none">None (use theme)</option>
							<option value="image">Image URL</option>
						</select>
					</div>
					{#if bgType === 'image'}
						<div class="field-row">
							<label>Image URL</label>
							<input type="text" bind:value={bgValue} placeholder="https://..." />
						</div>
					{/if}
				</div>
			{:else if activeTab === 'layout'}
				<div class="settings-section">
					<h3>Dashboard Title</h3>
					<input type="text" bind:value={title} />
				</div>

				<div class="settings-section">
					<h3>Navbar</h3>
					<div class="field-row">
						<label>Columns</label>
						<input type="number" bind:value={navbarColumns} min="4" max="48" />
					</div>
				</div>

				<div class="settings-section">
					<h3>Grid Settings</h3>
					<div class="field-row">
						<label>Cell Size (px)</label>
						<input type="number" bind:value={cellSize} min="40" max="200" />
					</div>
					<div class="field-row">
						<label>Gap (px)</label>
						<input type="number" bind:value={gap} min="0" max="40" />
					</div>
				</div>

				<div class="settings-section">
					<h3>Breakpoints</h3>
					<div class="breakpoints-list">
						{#each breakpoints as bp, i}
							<div class="breakpoint-row">
								<div class="field-row">
									<label>Name</label>
									<input type="text" bind:value={bp.name} placeholder="Layout name" />
								</div>
								<div class="field-row">
									<label>Min Width</label>
									<input type="number" bind:value={bp.minWidth} min="0" />
								</div>
								<div class="field-row">
									<label>Columns</label>
									<input type="number" bind:value={bp.columns} min="1" max="20" />
								</div>
								<button class="btn-remove" onclick={() => removeBreakpoint(i)} disabled={breakpoints.length <= 1} title="Remove">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
										<path d="M18 6L6 18M6 6l12 12" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
					<button class="btn-add-bp" onclick={addBreakpoint}>Add Breakpoint</button>
				</div>
			{:else if activeTab === 'cache'}
				<div class="settings-section">
					<h3>Icon Cache</h3>
					<p class="cache-desc">Favicon icons are cached locally for faster loading. Clearing removes all cached icons. Rebuilding clears and re-fetches icons for all services.</p>
					<div class="cache-stats">
						<div class="cache-stat">
							<span class="cache-stat-label">Cached icons</span>
							<span class="cache-stat-value">{cacheCount}</span>
						</div>
						<div class="cache-stat">
							<span class="cache-stat-label">Total size</span>
							<span class="cache-stat-value">{formatBytes(cacheSize)}</span>
						</div>
					</div>
					{#if cacheRebuildResult}
						<div class="cache-result">
							Rebuilt {cacheRebuildResult.rebuilt} icon{cacheRebuildResult.rebuilt !== 1 ? 's' : ''}
							{#if cacheRebuildResult.errors.length > 0}
								<span class="cache-errors"> — {cacheRebuildResult.errors.length} failed: {cacheRebuildResult.errors.join(', ')}</span>
							{/if}
						</div>
					{/if}
					<div class="cache-actions">
						<button class="btn-rebuild-cache" onclick={rebuildIconCache} disabled={cacheRebuilding}>
							{#if cacheRebuilding}
								Rebuilding...
							{:else}
								Rebuild Icon Cache
							{/if}
						</button>
						<button class="btn-clear-cache" onclick={clearIconCache} disabled={cacheClearing || cacheCount === 0}>
							{#if cacheClearing}
								Clearing...
							{:else}
								Clear Icon Cache
							{/if}
						</button>
					</div>
				</div>
			{:else if activeTab === 'admin'}
				<AdminPanel />
			{:else if activeTab === 'export'}
				<div class="settings-section">
					<h3>Export</h3>
					<p class="export-desc">Download a complete backup of your dashboard configuration, including services, layout, settings, and integrations.</p>
					<button class="btn-export" onclick={handleExport} disabled={exporting}>
						{#if exporting}
							Exporting...
						{:else}
							Export Dashboard
						{/if}
					</button>
				</div>

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
								{#if importData.services}
										<label class="section-check">
											<input type="checkbox" checked={importSections.includes('services')} onchange={() => toggleImportSection('services')} />
											<span>Services</span>
											<span class="section-count">{Array.isArray(importData.services?.services) ? importData.services.services.length : 0} services</span>
										</label>
									{/if}
									{#if importData.layout}
										<label class="section-check">
											<input type="checkbox" checked={importSections.includes('layout')} onchange={() => toggleImportSection('layout')} />
											<span>Layout</span>
											<span class="section-count">{Array.isArray(importData.layout?.items) ? importData.layout.items.length : 0} items</span>
										</label>
									{/if}
									{#if importData.settings}
										<label class="section-check">
											<input type="checkbox" checked={importSections.includes('settings')} onchange={() => toggleImportSection('settings')} />
											<span>Settings</span>
											<span class="section-count">Theme & preferences</span>
										</label>
									{/if}
									{#if importData.integrations}
										<label class="section-check">
											<input type="checkbox" checked={importSections.includes('integrations')} onchange={() => toggleImportSection('integrations')} />
											<span>Integrations</span>
											<span class="section-count">External connections</span>
										</label>
									{/if}
								</div>
							</div>
							<p class="import-warning">Importing will replace the selected sections. This cannot be undone.</p>
							<div class="import-actions">
								<button class="btn-cancel" onclick={() => { importData = null; importSections = []; }}>Cancel</button>
								<button class="btn-import" onclick={handleImport} disabled={importSections.length === 0 || importing}>
									{#if importing}
										Importing...
									{:else}
										Import Selected
									{/if}
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		{#if activeTab !== 'export'}
			<div class="modal-footer">
				<button class="btn-cancel" onclick={close}>Cancel</button>
				<button class="btn-save" onclick={saveAll}>Save</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		animation: fadeIn 0.2s ease;
	}

	.modal-overlay.closing {
		animation: fadeOut 0.2s ease forwards;
	}

	.modal {
		background: var(--bg-modal);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		width: 960px;
		max-width: 94vw;
		height: 720px;
		max-height: 90vh;
		min-height: 500px;
		display: flex;
		flex-direction: column;
		animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.modal.closing {
		animation: slideDown 0.2s ease forwards;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.modal-header h2 {
		font-size: 1.2rem;
		font-weight: 600;
	}

	.btn-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		background: var(--danger);
		color: white;
		transition: opacity var(--transition);
	}

	.btn-close:hover {
		opacity: 0.85;
	}

	.modal-body {
		flex: 1;
		overflow: hidden;
		display: flex;
		min-height: 0;
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		padding: 8px;
		width: 160px;
		flex-shrink: 0;
		overflow-y: auto;
	}

	.tab {
		padding: 10px 12px;
		border: none;
		background: none;
		color: var(--text-secondary);
		font-size: 0.9rem;
		font-weight: 500;
		border-left: 3px solid transparent;
		border-radius: var(--radius-sm);
		text-align: left;
		transition: all var(--transition);
	}

	.tab:hover {
		color: var(--text-primary);
		background: var(--bg-card-hover);
	}

	.tab.active {
		color: var(--accent);
		border-left-color: var(--accent);
		background: var(--accent-bg);
	}

	.tab-content {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
		min-width: 0;
	}

	.settings-section {
		margin-bottom: 24px;
	}

	.settings-section h3 {
		font-size: 0.95rem;
		font-weight: 600;
		margin-bottom: 12px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.section-header h3 {
		margin-bottom: 0;
	}

	.btn-reset {
		padding: 4px 12px;
		font-size: 0.8rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-secondary);
		transition: all var(--transition);
	}

	.btn-reset:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Theme grid */
	.theme-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 10px;
	}

	.theme-card {
		border: 2px solid var(--border);
		border-radius: var(--radius-sm);
		background: none;
		padding: 0;
		cursor: pointer;
		overflow: hidden;
		transition: border-color var(--transition);
	}

	.theme-card:hover {
		border-color: var(--border-light);
	}

	.theme-card.active {
		border-color: var(--accent);
	}

	.theme-preview {
		padding: 14px 10px;
		text-align: center;
		height: 55px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		box-sizing: border-box;
	}

	.theme-preview[data-theme-preview="dark"] { background: #0f0f1a; color: #e0e0e0; }
	.theme-preview[data-theme-preview="light"] { background: #f0f2f5; color: #1a1a2e; }
	.theme-preview[data-theme-preview="nord"] { background: #2e3440; color: #eceff4; }
	.theme-preview[data-theme-preview="dracula"] { background: #282a36; color: #f8f8f2; }
	.theme-preview[data-theme-preview="solarized-dark"] { background: #002b36; color: #fdf6e3; }
	.theme-preview[data-theme-preview="solarized-light"] { background: #fdf6e3; color: #073642; }
	.theme-preview[data-theme-preview="catppuccin-mocha"] { background: #1e1e2e; color: #cdd6f4; }
	.theme-preview[data-theme-preview="gruvbox-dark"] { background: #282828; color: #ebdbb2; }
	.theme-preview[data-theme-preview="one-dark"] { background: #282c34; color: #abb2bf; }
	.theme-preview[data-theme-preview="tokyo-night"] { background: #1a1b26; color: #c0caf5; }

	.custom-preview {
		background: conic-gradient(from 0deg, #ff4f6f, #ffbf4f, #4fdd8f, #4f8fff, #bd93f9, #ff4f6f);
		color: white;
	}

	.theme-label {
		font-size: 0.8rem;
		font-weight: 500;
	}

	/* Palette editor */
	.palette-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 8px;
	}

	.palette-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.palette-row label {
		font-size: 0.8rem;
		color: var(--text-secondary);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.palette-row input[type="color"] {
		width: 32px;
		height: 28px;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-primary);
		cursor: pointer;
		flex-shrink: 0;
	}

	/* Option cards (style, animations, scrollbar) */
	.option-cards {
		display: flex;
		gap: 10px;
	}

	.option-card {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 14px 10px;
		border: 2px solid var(--border);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition);
	}

	.option-card:hover {
		border-color: var(--border-light);
		color: var(--text-primary);
	}

	.option-card.active {
		border-color: var(--accent);
		color: var(--accent);
	}

	.style-box {
		width: 40px;
		height: 28px;
		border: 2px solid currentColor;
	}

	.default-box {
		border-radius: 6px;
	}

	.sharp-box {
		border-radius: 2px;
	}

	.pill-box {
		border-radius: 999px;
	}

	.anim-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 28px;
		color: var(--text-muted);
	}

	.option-card.active .anim-preview {
		color: var(--accent);
	}

	.scroll-preview {
		width: 40px;
		height: 28px;
		border: 1px solid var(--border);
		position: relative;
		overflow: hidden;
		border-radius: 4px;
	}

	.thin-scroll::after {
		content: '';
		position: absolute;
		right: 2px;
		top: 3px;
		bottom: 3px;
		width: 3px;
		border-radius: 2px;
		background: var(--text-muted);
	}

	.wide-scroll::after {
		content: '';
		position: absolute;
		right: 2px;
		top: 2px;
		bottom: 2px;
		width: 7px;
		border-radius: 3px;
		background: var(--text-muted);
	}

	.hidden-scroll {
		border-style: dashed;
	}

	.option-card.active .scroll-preview::after {
		background: var(--accent);
	}

	.option-card.active .scroll-preview {
		border-color: var(--accent);
	}

	/* Toggle */
	.toggle-row {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.9rem;
		color: var(--text-primary);
		cursor: pointer;
	}

	.toggle-row input[type="checkbox"] {
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
		cursor: pointer;
	}

	/* Field row */
	.field-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
	}

	.field-row label {
		font-size: 0.85rem;
		color: var(--text-secondary);
		min-width: 100px;
	}

	.field-row input,
	.field-row select {
		flex: 1;
		padding: 8px 12px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		transition: border-color var(--transition);
	}

	.field-row input:focus,
	.field-row select:focus {
		border-color: var(--accent);
	}

	.breakpoints-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.breakpoint-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.breakpoint-row .field-row {
		flex: 1;
		margin-bottom: 0;
	}

	.breakpoint-row .field-row label {
		min-width: auto;
		font-size: 0.8rem;
	}

	.btn-remove {
		padding: 6px;
		border-radius: 4px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.btn-remove:hover:not(:disabled) {
		background: var(--danger);
		color: white;
	}

	.btn-remove:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.btn-add-bp {
		width: 100%;
		padding: 8px;
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-secondary);
		font-size: 0.85rem;
		transition: all var(--transition);
	}

	.btn-add-bp:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 16px 20px;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}

	.btn-cancel {
		padding: 8px 20px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-weight: 500;
		transition: all var(--transition);
	}

	.btn-cancel:hover {
		border-color: var(--border-light);
	}

	.btn-save {
		padding: 8px 20px;
		background: var(--accent);
		color: white;
		border-radius: var(--radius-sm);
		font-weight: 500;
		transition: background var(--transition);
	}

	.btn-save:hover {
		background: var(--accent-hover);
	}

	.cache-desc {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin-bottom: 16px;
		line-height: 1.4;
	}

	.cache-stats {
		display: flex;
		gap: 16px;
		margin-bottom: 16px;
	}

	.cache-stat {
		flex: 1;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.cache-stat-label {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.cache-stat-value {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--accent);
	}

	.cache-actions {
		display: flex;
		gap: 10px;
	}

	.btn-rebuild-cache {
		flex: 1;
		padding: 10px 20px;
		background: var(--accent);
		color: white;
		border-radius: var(--radius-sm);
		font-weight: 500;
		font-size: 0.9rem;
		transition: opacity var(--transition);
	}

	.btn-rebuild-cache:hover:not(:disabled) {
		opacity: 0.85;
	}

	.btn-rebuild-cache:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-clear-cache {
		flex: 1;
		padding: 10px 20px;
		background: var(--danger);
		color: white;
		border-radius: var(--radius-sm);
		font-weight: 500;
		font-size: 0.9rem;
		transition: opacity var(--transition);
	}

	.btn-clear-cache:hover:not(:disabled) {
		opacity: 0.85;
	}

	.btn-clear-cache:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.cache-result {
		font-size: 0.85rem;
		color: var(--success);
		margin-bottom: 12px;
		padding: 8px 12px;
		background: var(--bg-primary);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
	}

	.cache-errors {
		color: var(--warning);
	}

	.settings-section input[type="text"],
	.settings-section input[type="number"] {
		width: 100%;
		padding: 8px 12px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		outline: none;
		transition: border-color var(--transition);
	}

	.settings-section input[type="text"]:focus,
	.settings-section input[type="number"]:focus {
		border-color: var(--accent);
	}

		/* Export/Import styles */
		.export-desc {
			font-size: 0.85rem;
			color: var(--text-secondary);
			margin-bottom: 16px;
			line-height: 1.5;
		}

		.btn-export {
			padding: 10px 24px;
			background: var(--accent);
			color: white;
			border-radius: var(--radius-sm);
			font-weight: 500;
			font-size: 0.9rem;
			transition: opacity var(--transition);
		}

		.btn-export:hover:not(:disabled) {
			opacity: 0.85;
		}

		.btn-export:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.import-file-area {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 10px;
			padding: 32px 20px;
			border: 2px dashed var(--border);
			border-radius: var(--radius);
			cursor: pointer;
			color: var(--text-muted);
			font-size: 0.85rem;
			transition: all var(--transition);
		}

		.import-file-area:hover {
			border-color: var(--accent);
			color: var(--accent);
			background: rgba(79, 143, 255, 0.05);
		}

		.import-file-area input[type="file"] {
			display: none;
		}

		.import-summary {
			padding: 14px;
			background: var(--bg-primary);
			border: 1px solid var(--border);
			border-radius: var(--radius-sm);
		}

		.import-file-name {
			font-size: 0.85rem;
			font-weight: 600;
			color: var(--text-primary);
			margin-bottom: 12px;
		}

		.import-sections {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		.section-check {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 10px 12px;
			border: 1px solid var(--border);
			border-radius: var(--radius-sm);
			cursor: pointer;
			font-size: 0.85rem;
			color: var(--text-primary);
			transition: all var(--transition);
		}

		.section-check:hover {
			border-color: var(--accent);
		}

		.section-check input[type="checkbox"] {
			width: 16px;
			height: 16px;
			accent-color: var(--accent);
			flex-shrink: 0;
		}

		.section-count {
			margin-left: auto;
			font-size: 0.75rem;
			color: var(--text-muted);
			white-space: nowrap;
		}

		.import-warning {
			font-size: 0.8rem;
			color: var(--danger);
			margin-top: 12px;
			margin-bottom: 0;
			line-height: 1.4;
		}

		.import-actions {
			display: flex;
			gap: 8px;
			justify-content: flex-end;
			margin-top: 16px;
		}

		.btn-import {
			padding: 8px 16px;
			background: var(--danger);
			color: white;
			border-radius: var(--radius-sm);
			font-weight: 500;
			font-size: 0.9rem;
			transition: opacity var(--transition);
		}

		.btn-import:hover:not(:disabled) {
			opacity: 0.85;
		}

		.btn-import:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes fadeOut {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes slideDown {
		from { opacity: 1; transform: translateY(0); }
		to { opacity: 0; transform: translateY(20px); }
	}
</style>