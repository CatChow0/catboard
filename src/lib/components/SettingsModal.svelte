<script lang="ts">
	import { untrack } from 'svelte';
	import { uid } from '$lib/utils/uid';
	import {
		settings, layout, activeBreakpointId, saveSettings, currentUser, exportDashboard, importDashboard,
		dashboards, activeDashboardId, fetchDashboardLayout, saveLayoutSettings, refreshActiveDashboard, getBreakpointLabel, GRID_DEFAULTS
	} from '$lib/stores/dashboard';
	import type { Layout } from '$lib/types';
	import { clearBrowserIconCache } from '$lib/stores/icons';
	import { themePresets, customPaletteDefaults, themeDefaults, FONTS, isFontName, THEME_KEYS, cleanThemeFile, MAX_CUSTOM_CSS } from '$lib/themes';
	import type { CustomPalette } from '$lib/stores/dashboard';
	import AdminPanel from './AdminPanel.svelte';
	import IntegrationsPanel from './settings/IntegrationsPanel.svelte';
	import BackupsPanel from './settings/BackupsPanel.svelte';

	let { onclose, initialTab, initialIntegration }: {
		onclose: () => void;
		/** Tab to open on (e.g. the widget catalog's "Set up" links). */
		initialTab?: 'integrations';
		initialIntegration?: string;
	} = $props();

	let activeTab = $state<'appearance' | 'layout' | 'integrations' | 'cache' | 'admin' | 'export'>(untrack(() => initialTab) ?? 'appearance');
	let closing = $state(false);

	let title = $state($settings.title);
	let breakpoints = $state([...($settings.layout?.breakpoints || [{ id: 'mobile', name: 'Mobile', minWidth: 0, columns: 4 }, { id: 'tablet', name: 'Tablet', minWidth: 800, columns: 6 }, { id: 'desktop', name: 'Desktop', minWidth: 1200, columns: 10 }])].map((bp, i) => bp.id ? bp : { ...bp, id: `bp-${bp.minWidth}-${i}` }));
	let selectedTheme = $state($settings.theme);
	let bgType = $state($settings.background?.type || 'none');
	let bgValue = $state($settings.background?.value || '');
	let stylePreset = $state($settings.stylePreset || 'default');
	let animations = $state($settings.animations || 'subtle');
	let scrollbarStyle = $state($settings.scrollbarStyle || 'thin');
	let customPalette = $state<CustomPalette>(
		$settings.customPalette || { ...customPaletteDefaults['dark'] }
	);
	let autoDark = $state($settings.autoDark || 'dark');
	let autoLight = $state($settings.autoLight || 'light');
	let radius = $state<number | undefined>($settings.radius);
	let accent = $state($settings.accent || '');
	let fontChoice = $state(!$settings.font ? '' : FONTS.includes($settings.font) ? $settings.font : 'other');
	let otherFont = $state($settings.font && !FONTS.includes($settings.font) ? $settings.font : '');
	let fontScale = $state($settings.fontScale ?? 100);
	let cardOpacity = $state($settings.cardOpacity ?? 100);
	let cardBlur = $state($settings.cardBlur ?? 0);
	let customCss = $state($settings.customCss ?? '');
	let statusCheckInterval = $state($settings.statusCheckInterval || 30000);

	const font = $derived(fontChoice === 'other' ? (isFontName(otherFont.trim()) ? otherFont.trim() : '') : fontChoice);
	const darkPresets = themePresets.filter((t) => !['light', 'solarized-light', 'catppuccin-latte', 'github-light'].includes(t.name));
	const lightPresets = themePresets.filter((t) => ['light', 'solarized-light', 'catppuccin-latte', 'github-light'].includes(t.name));

	/** Appearance fields as stored in settings (empty values left out). */
	function appearance() {
		return {
			theme: selectedTheme,
			autoDark: selectedTheme === 'auto' ? autoDark : undefined,
			autoLight: selectedTheme === 'auto' ? autoLight : undefined,
			customPalette: selectedTheme === 'custom' ? $state.snapshot(customPalette) : undefined,
			background: { type: bgType, value: bgValue },
			stylePreset,
			animations,
			scrollbarStyle,
			radius,
			accent: accent || undefined,
			font: font || undefined,
			fontScale: fontScale !== 100 ? fontScale : undefined,
			cardOpacity: cardOpacity < 100 ? cardOpacity : undefined,
			cardBlur: cardBlur > 0 ? cardBlur : undefined,
			customCss: customCss.trim() ? customCss.slice(0, MAX_CUSTOM_CSS) : undefined
		};
	}

	// Every appearance change shows at once; closing without saving puts the
	// previous look back.
	const originalSettings = $state.snapshot($settings);
	$effect(() => {
		const next = appearance();
		untrack(() => settings.update((s) => ({ ...s, ...next })));
	});

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
		breakpoints = [...breakpoints, { id: uid(), name: 'New Layout', minWidth: 0, columns: 4 }];
	}

	function removeBreakpoint(index: number) {
		if (breakpoints.length <= 1) return;
		breakpoints = breakpoints.filter((_, i) => i !== index);
	}

	// --- Layout of each dashboard x breakpoint ---------------------------------
	// Empty fields (null) mean "default". Changes stay pending (edits) until Save;
	// the pair on screen is previewed live and restored on Cancel.

	type PairValues = { cellSize: number | null; gap: number | null; navbarColumns: number | null; rowHeight: number | null; marginTop: number | null; marginBottom: number | null };

	const defaultCellSize = $settings.layout?.cellSize || GRID_DEFAULTS.cellSize;
	const defaultGap = $settings.layout?.gap ?? GRID_DEFAULTS.gap;
	const originalLayout: Layout = JSON.parse(JSON.stringify($layout));
	let saved = false;

	let selDash = $state($activeDashboardId);
	let selBp = $state($activeBreakpointId);
	let dashLayouts = $state<Record<string, Layout>>({ [$activeDashboardId]: JSON.parse(JSON.stringify($layout)) });
	let edits = $state<Record<string, PairValues>>({});
	const pairKey = (d: string, b: string) => `${d}|${b}`;
	const isLivePair = $derived(selDash === $activeDashboardId && selBp === $activeBreakpointId);

	function storedValues(d: string, b: string): PairValues {
		const per = dashLayouts[d]?.layouts?.[b];
		return {
			cellSize: per?.grid?.cellSize ?? null,
			gap: per?.grid?.gap ?? null,
			navbarColumns: per?.navbar?.columns ?? null,
			rowHeight: per?.navbar?.rowHeight ?? null,
			marginTop: per?.navbar?.marginTop ?? null,
			marginBottom: per?.navbar?.marginBottom ?? null
		};
	}

	let form = $state<PairValues>(storedValues($activeDashboardId, $activeBreakpointId));

	async function selectPair(d: string, b: string) {
		selDash = d;
		selBp = b;
		if (!dashLayouts[d]) {
			try {
				dashLayouts = { ...dashLayouts, [d]: await fetchDashboardLayout(d) };
			} catch {
				// keep the defaults
			}
		}
		if (selDash === d && selBp === b) form = { ...(edits[pairKey(d, b)] ?? storedValues(d, b)) };
	}

	/** Field changed: remember it and preview it when it is the dashboard on screen. */
	function changed() {
		edits = { ...edits, [pairKey(selDash, selBp)]: { ...form } };
		if (isLivePair) preview(selBp, form);
	}

	function preview(bp: string, v: PairValues) {
		layout.update((l) => {
			const per = l.layouts[bp];
			if (!per) return l;
			per.grid = { cellSize: v.cellSize ?? undefined, gap: v.gap ?? undefined };
			per.navbar = {
				...per.navbar,
				columns: v.navbarColumns ?? GRID_DEFAULTS.navbarColumns,
				rowHeight: v.rowHeight ?? undefined,
				marginTop: v.marginTop ?? undefined,
				marginBottom: v.marginBottom ?? undefined
			};
			return l;
		});
	}

	function resetPair() {
		form = { cellSize: null, gap: null, navbarColumns: null, rowHeight: null, marginTop: null, marginBottom: null };
		changed();
	}

	/** Same values for every breakpoint of the selected dashboard. */
	function copyToAllBreakpoints() {
		const next = { ...edits };
		for (const bp of breakpoints) next[pairKey(selDash, bp.id)] = { ...form };
		edits = next;
		if (selDash === $activeDashboardId) preview($activeBreakpointId, form);
		copiedNotice = true;
		setTimeout(() => (copiedNotice = false), 1800);
	}
	let copiedNotice = $state(false);
	const pendingCount = $derived(Object.keys(edits).length);

	function applyTheme(themeName: string) {
		if (themeName === 'auto') {
			// keeps the current style; the two presets are picked below
		} else if (themeName === 'custom') {
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
	}

	/** A style card resets a custom corner radius. */
	function pickStyle(preset: 'default' | 'sharp' | 'pill') {
		stylePreset = preset;
		radius = undefined;
	}

	/** Tab in the CSS editor indents instead of leaving the field. */
	function cssKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab' || e.shiftKey) return;
		e.preventDefault();
		const el = e.currentTarget as HTMLTextAreaElement;
		const { selectionStart: a, selectionEnd: b } = el;
		customCss = customCss.slice(0, a) + '\t' + customCss.slice(b);
		requestAnimationFrame(() => el.setSelectionRange(a + 1, a + 1));
	}

	let themeMessage = $state<{ ok: boolean; text: string } | null>(null);

	function exportTheme() {
		const data: Record<string, unknown> = { catboardTheme: 1 };
		const a = appearance() as Record<string, unknown>;
		for (const k of THEME_KEYS) if (a[k] !== undefined) data[k] = a[k];
		const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = `catboard-theme-${selectedTheme}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function importTheme(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		file.text().then((text) => {
			try {
				const t = cleanThemeFile(JSON.parse(text));
				if (t.customPalette) customPalette = t.customPalette;
				if (t.theme) selectedTheme = t.theme;
				autoDark = t.autoDark ?? 'dark';
				autoLight = t.autoLight ?? 'light';
				if (t.stylePreset) stylePreset = t.stylePreset;
				if (t.animations) animations = t.animations;
				if (t.scrollbarStyle) scrollbarStyle = t.scrollbarStyle;
				if (t.background) {
					bgType = t.background.type;
					bgValue = t.background.value;
				}
				radius = t.radius;
				accent = t.accent ?? '';
				fontChoice = !t.font ? '' : FONTS.includes(t.font) ? t.font : 'other';
				otherFont = t.font && !FONTS.includes(t.font) ? t.font : '';
				fontScale = t.fontScale ?? 100;
				cardOpacity = t.cardOpacity ?? 100;
				cardBlur = t.cardBlur ?? 0;
				customCss = t.customCss ?? '';
				themeMessage = { ok: true, text: `Theme "${file.name}" applied: Save to keep it.` };
			} catch (err) {
				themeMessage = { ok: false, text: err instanceof Error && err.message !== 'Unexpected end of JSON input' ? err.message : 'This file is not valid JSON' };
			}
		});
	}

	function resetPalette() {
		const base = customPaletteDefaults[selectedTheme] ? selectedTheme : 'dark';
		customPalette = { ...customPaletteDefaults[base] };
	}

	async function saveAll() {
		const data: any = {
			...$settings,
			...appearance(),
			title,
			statusCheckInterval,
			layout: { cellSize: defaultCellSize, gap: defaultGap, breakpoints }
		};
		// Unset options are left out of the file rather than stored as null.
		for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
		await saveSettings(data);
		for (const [key, v] of Object.entries(edits)) {
			const [d, b] = key.split('|');
			await saveLayoutSettings(d, b, {
				cellSize: v.cellSize ?? undefined,
				gap: v.gap ?? undefined,
				navbarColumns: v.navbarColumns ?? GRID_DEFAULTS.navbarColumns,
				rowHeight: v.rowHeight ?? undefined,
				marginTop: v.marginTop ?? undefined,
				marginBottom: v.marginBottom ?? undefined
			});
		}
		saved = true;
		await refreshActiveDashboard();
		close();
	}

	function close() {
		// Closing without saving: drop the live preview.
		if (!saved && Object.keys(edits).length) layout.set(originalLayout);
		if (!saved) settings.set(originalSettings);
		closing = true;
		const duration = $settings.animations === 'none' ? 0 : 200;
		setTimeout(() => onclose(), duration);
	}

	let showAdmin = $derived($currentUser?.role === 'admin' || $currentUser?.role === 'mini-admin');

	let cacheCount = $state(0);
	let cacheSize = $state(0);
	let cacheUploads = $state(0);
	let cacheMisses = $state(0);
	let cacheClearing = $state(false);
	let cacheRebuilding = $state(false);
	let cacheRebuildResult = $state<{ rebuilt: number; errors: string[] } | null>(null);

	async function loadCacheStats() {
		try {
			const res = await fetch('/api/cache');
			const data = await res.json();
			cacheCount = data.count;
			cacheSize = data.size;
			cacheUploads = data.uploads ?? 0;
			cacheMisses = data.misses ?? 0;
		} catch {}
	}

	async function clearIconCache() {
		cacheClearing = true;
		cacheRebuildResult = null;
		try {
			await fetch('/api/cache', { method: 'DELETE' });
			await clearBrowserIconCache();
			await loadCacheStats();
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
			// Tiles fetch the rebuilt icons again.
			await clearBrowserIconCache();
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

	/** Dashboards and tiles in an exported layout (every dashboard, widest breakpoint). */
	function layoutSummary(l: Partial<Layout> | undefined): string {
		const pages = [l?.layouts, ...Object.values(l?.pages ?? {})].filter(Boolean) as Record<string, { items?: unknown[] }>[];
		const items = pages.reduce((n, p) => n + Math.max(0, ...Object.values(p).map((bp) => bp.items?.length ?? 0)), 0);
		return `${pages.length} dashboard${pages.length === 1 ? '' : 's'}, ${items} item${items === 1 ? '' : 's'}`;
	}
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
			// The imported settings are the new look: keep them on close.
			saved = true;
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
	<div class="modal sheet-full" class:closing>
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
				<button class="tab" class:active={activeTab === 'integrations'} onclick={() => (activeTab = 'integrations')}>Integrations</button>
				<button class="tab" class:active={activeTab === 'cache'} onclick={() => (activeTab = 'cache')}>Cache</button>
				{#if showAdmin}
					<button class="tab" class:active={activeTab === 'admin'} onclick={() => (activeTab = 'admin')}>Admin</button>
					<button class="tab" class:active={activeTab === 'export'} onclick={() => (activeTab = 'export')}>Export</button>
				{/if}
			</div>

			<div class="tab-content" class:flush={activeTab === 'integrations'}>
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
						<button class="theme-card" class:active={selectedTheme === 'auto'} onclick={() => applyTheme('auto')}>
							<div class="theme-preview" data-theme-preview="auto">
								<span class="theme-label">Auto</span>
							</div>
						</button>
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

				{#if selectedTheme === 'auto'}
					<div class="settings-section">
						<h3>Auto theme</h3>
						<p class="section-hint">Follows the light or dark mode of the device.</p>
						<div class="field-row">
							<label for="auto-dark">Dark mode</label>
							<select id="auto-dark" bind:value={autoDark}>
								{#each darkPresets as t}<option value={t.name}>{t.label}</option>{/each}
							</select>
						</div>
						<div class="field-row">
							<label for="auto-light">Light mode</label>
							<select id="auto-light" bind:value={autoLight}>
								{#each lightPresets as t}<option value={t.name}>{t.label}</option>{/each}
							</select>
						</div>
					</div>
				{/if}

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
						<button class="option-card" class:active={stylePreset === 'default' && radius === undefined} onclick={() => pickStyle('default')}>
							<div class="option-preview">
								<div class="style-box default-box"></div>
							</div>
							<span>Rounded</span>
						</button>
						<button class="option-card" class:active={stylePreset === 'sharp' && radius === undefined} onclick={() => pickStyle('sharp')}>
							<div class="option-preview">
								<div class="style-box sharp-box"></div>
							</div>
							<span>Sharp</span>
						</button>
						<button class="option-card" class:active={stylePreset === 'pill' && radius === undefined} onclick={() => pickStyle('pill')}>
							<div class="option-preview">
								<div class="style-box pill-box"></div>
							</div>
							<span>Pill</span>
						</button>
					</div>
					<div class="range-row">
						<label for="radius">Corner radius</label>
						<input id="radius" type="range" min="0" max="24" step="1" value={radius ?? (stylePreset === 'sharp' ? 4 : stylePreset === 'pill' ? 20 : 12)} oninput={(e) => (radius = Number(e.currentTarget.value))} />
						<span class="range-value">{radius === undefined ? 'Preset' : `${radius}px`}</span>
					</div>
				</div>

				<div class="settings-section">
					<h3>Text</h3>
					<div class="field-row">
						<label for="font">Font</label>
						<select id="font" bind:value={fontChoice}>
							<option value="">System</option>
							{#each FONTS as f}<option value={f}>{f}</option>{/each}
							<option value="other">Other Google font…</option>
						</select>
					</div>
					{#if fontChoice === 'other'}
						<div class="field-row">
							<label for="other-font">Font name</label>
							<input id="other-font" type="text" bind:value={otherFont} placeholder="e.g. Space Grotesk" maxlength="40" />
						</div>
						{#if otherFont.trim() && !font}<p class="section-hint"><b>Letters, digits and spaces only.</b></p>{/if}
					{/if}
					{#if font}<p class="section-hint">Loaded from Google Fonts.</p>{/if}
					<div class="range-row">
						<label for="font-scale">Text size</label>
						<input id="font-scale" type="range" min="90" max="120" step="5" bind:value={fontScale} />
						<span class="range-value">{fontScale}%</span>
					</div>
				</div>

				<div class="settings-section">
					<h3>Cards</h3>
					<div class="range-row">
						<label for="accent-on">Accent color</label>
						<span class="cb-form">
							<label class="toggle-switch" style="margin: 0">
								<input id="accent-on" type="checkbox" checked={!!accent} onchange={(e) => (accent = e.currentTarget.checked ? '#4f8fff' : '')} />
								<span class="toggle-slider"></span>
							</label>
						</span>
						{#if accent}
							<input class="accent-input" type="color" bind:value={accent} aria-label="Accent color" />
						{:else}
							<span class="range-value">From theme</span>
						{/if}
					</div>
					<div class="range-row">
						<label for="card-opacity">Opacity</label>
						<input id="card-opacity" type="range" min="40" max="100" step="5" bind:value={cardOpacity} />
						<span class="range-value">{cardOpacity}%</span>
					</div>
					<div class="range-row">
						<label for="card-blur">Blur</label>
						<input id="card-blur" type="range" min="0" max="20" step="1" bind:value={cardBlur} />
						<span class="range-value">{cardBlur ? `${cardBlur}px` : 'Off'}</span>
					</div>
					<p class="section-hint">See-through, blurred cards look best over a background image.</p>
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

				<div class="settings-section">
					<div class="section-header">
						<h3>Custom CSS</h3>
						{#if customCss}<button class="btn-reset" onclick={() => (customCss = '')}>Clear</button>{/if}
					</div>
					<p class="section-hint">Applied live, only for your account. Broken page? Open CatBoard with <code>?nocss</code> at the end of the address to skip it.</p>
					<textarea class="css-editor" bind:value={customCss} onkeydown={cssKeydown} spellcheck="false" maxlength={MAX_CUSTOM_CSS} placeholder={'.cb-item-clock {\n\tborder: 1px solid var(--accent);\n}'}></textarea>
					<details class="css-help">
						<summary>What can I style?</summary>
						<ul>
							<li><code>--bg-primary</code>, <code>--bg-card</code>, <code>--text-primary</code>, <code>--accent</code>, <code>--radius</code>… on <code>.cb-root</code>: every colour and size of the theme.</li>
							<li><code>.cb-item-&lt;type&gt;</code>: one kind of tile, e.g. <code>.cb-item-service</code>, <code>.cb-item-clock</code>, <code>.cb-item-jenkins</code>.</li>
							<li><code>[data-theme='nord']</code>, <code>[data-style]</code>, <code>[data-animations]</code>: rules for one theme or option.</li>
							<li><code>.navbar</code>: the top bar.</li>
						</ul>
					</details>
				</div>

				<div class="settings-section">
					<h3>Theme file</h3>
					<p class="section-hint">Share this look: colors, style, text, cards, background and custom CSS.</p>
					<div class="theme-file">
						<button class="btn-reset" onclick={exportTheme}>Export theme</button>
						<label class="btn-reset file-btn">
							Import theme
							<input type="file" accept="application/json,.json" onchange={importTheme} hidden />
						</label>
					</div>
					{#if themeMessage}<p class="theme-message" class:error={!themeMessage.ok}>{themeMessage.text}</p>{/if}
				</div>
			{:else if activeTab === 'layout'}
				<div class="settings-section">
					<h3>Dashboard Title</h3>
					<input type="text" bind:value={title} />
				</div>

				<div class="settings-section">
					<h3>Service status</h3>
					<div class="field-row">
						<label for="status-interval">Check every</label>
						<select id="status-interval" bind:value={statusCheckInterval}>
							<option value={10000}>10 seconds</option>
							<option value={30000}>30 seconds</option>
							<option value={60000}>1 minute</option>
							<option value={300000}>5 minutes</option>
							<option value={600000}>10 minutes</option>
						</select>
					</div>
				</div>

				<div class="settings-section">
					<h3>Breakpoints</h3>
					<p class="section-hint">Screen sizes shared by every dashboard: the widest breakpoint whose minimum width fits the window is used. Columns set the grid width.</p>
					<div class="breakpoints-list">
						{#each breakpoints as bp, i (bp.id)}
							<div class="breakpoint-row">
								<div class="field-row">
									<label for="bp-name-{bp.id}">Name</label>
									<input id="bp-name-{bp.id}" type="text" bind:value={bp.name} placeholder="Layout name" />
								</div>
								<div class="field-row">
									<label for="bp-min-{bp.id}">Min Width</label>
									<input id="bp-min-{bp.id}" type="number" bind:value={bp.minWidth} min="0" />
								</div>
								<div class="field-row">
									<label for="bp-cols-{bp.id}">Columns</label>
									<input id="bp-cols-{bp.id}" type="number" bind:value={bp.columns} min="1" max="20" />
								</div>
								<button class="btn-remove" onclick={() => removeBreakpoint(i)} disabled={breakpoints.length <= 1} title="Remove" aria-label="Remove breakpoint">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
										<path d="M18 6L6 18M6 6l12 12" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
					<button class="btn-add-bp" onclick={addBreakpoint}>Add Breakpoint</button>
				</div>

				{#if $currentUser?.canEdit}
					<div class="settings-section">
						<h3>Dashboard Layout</h3>
						<p class="section-hint">Each dashboard has its own grid and navbar settings for every breakpoint. Empty fields use the default shown in grey.</p>
						<div class="pair-picker">
							<label class="pair-dash">
								<span>Dashboard</span>
								<select value={selDash} onchange={(e) => selectPair((e.currentTarget as HTMLSelectElement).value, selBp)}>
									{#each $dashboards as d (d.id)}
										<option value={d.id}>{d.name}{d.id === $activeDashboardId ? ' (shown)' : ''}</option>
									{/each}
								</select>
							</label>
							<div class="bp-tabs" role="tablist" aria-label="Breakpoint">
								{#each breakpoints as bp (bp.id)}
									<button
										class="bp-tab"
										class:active={selBp === bp.id}
										class:edited={!!edits[pairKey(selDash, bp.id)]}
										role="tab"
										aria-selected={selBp === bp.id}
										onclick={() => selectPair(selDash, bp.id)}
									>
										{bp.name || getBreakpointLabel(breakpoints, bp.id)}
									</button>
								{/each}
							</div>
						</div>

						<div class="pair-grid">
							<fieldset>
								<legend>Grid</legend>
								<div class="field-row">
									<label for="lay-cell">Cell height (px)</label>
									<input id="lay-cell" type="number" min="40" max="300" placeholder={String(defaultCellSize)} bind:value={form.cellSize} oninput={changed} />
								</div>
								<div class="field-row">
									<label for="lay-gap">Gap (px)</label>
									<input id="lay-gap" type="number" min="0" max="48" placeholder={String(defaultGap)} bind:value={form.gap} oninput={changed} />
								</div>
							</fieldset>
							<fieldset>
								<legend>Navbar</legend>
								<div class="field-row">
									<label for="lay-nbcols">Columns</label>
									<input id="lay-nbcols" type="number" min="4" max="48" placeholder={String(GRID_DEFAULTS.navbarColumns)} bind:value={form.navbarColumns} oninput={changed} />
								</div>
								<div class="field-row">
									<label for="lay-nbrow">Row height (px)</label>
									<input id="lay-nbrow" type="number" min="28" max="120" placeholder={String(GRID_DEFAULTS.navbarRowHeight)} bind:value={form.rowHeight} oninput={changed} />
								</div>
								<div class="field-row">
									<label for="lay-nbmt">Top margin (px)</label>
									<input id="lay-nbmt" type="number" min="0" max="48" placeholder={String(GRID_DEFAULTS.navbarMarginTop)} bind:value={form.marginTop} oninput={changed} />
								</div>
								<div class="field-row">
									<label for="lay-nbmb">Bottom margin (px)</label>
									<input id="lay-nbmb" type="number" min="0" max="48" placeholder={String(GRID_DEFAULTS.navbarMarginBottom)} bind:value={form.marginBottom} oninput={changed} />
								</div>
							</fieldset>
						</div>

						<div class="pair-actions">
							<button class="btn-add-bp" onclick={copyToAllBreakpoints}>{copiedNotice ? 'Copied to every breakpoint' : 'Copy to every breakpoint'}</button>
							<button class="btn-add-bp" onclick={resetPair}>Reset to defaults</button>
						</div>
						<p class="section-hint">
							{#if isLivePair}Previewed live on the dashboard behind.{:else}This breakpoint is not the one on screen: changes apply after saving.{/if}
							{#if pendingCount}<b>{pendingCount} unsaved {pendingCount > 1 ? 'layouts' : 'layout'}.</b>{/if}
						</p>
					</div>
				{/if}
			{:else if activeTab === 'cache'}
				<div class="settings-section">
					<h3>Icon Cache</h3>
					<p class="cache-desc">Service icons (selfh.st and homarr libraries, custom URLs, favicons) are downloaded once by CatBoard and served from its cache. Icons that could not be found are retried after a day. Clearing keeps uploaded images; rebuilding clears and fetches the icons of every service again.</p>
					<div class="cache-stats">
						<div class="cache-stat">
							<span class="cache-stat-label">Cached icons</span>
							<span class="cache-stat-value">{cacheCount}</span>
						</div>
						<div class="cache-stat">
							<span class="cache-stat-label">Uploaded</span>
							<span class="cache-stat-value">{cacheUploads}</span>
						</div>
						<div class="cache-stat">
							<span class="cache-stat-label">Not found (retried tomorrow)</span>
							<span class="cache-stat-value">{cacheMisses}</span>
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
					{#if showAdmin}
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
					{/if}
				</div>
			{:else if activeTab === 'integrations'}
				<IntegrationsPanel initial={initialIntegration} />
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
											<span class="section-count">{layoutSummary(importData.layout)}</span>
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

		<!-- Export and Integrations act on their own (each connection has its Save button). -->
		{#if activeTab !== 'export' && activeTab !== 'integrations'}
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

	.tab-content.flush {
		padding: 0 !important;
		overflow: hidden;
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

	/* Sliders, CSS editor, theme file */
	.range-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 10px;
		margin-bottom: 10px;
	}

	.range-row > label:first-child {
		font-size: 0.85rem;
		color: var(--text-secondary);
		min-width: 100px;
	}

	.range-row input[type='range'] {
		flex: 1;
		accent-color: var(--accent);
	}

	.range-value {
		min-width: 64px;
		text-align: right;
		font-size: 0.8rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.accent-input {
		width: 44px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: none;
		cursor: pointer;
	}

	.css-editor {
		width: 100%;
		min-height: 160px;
		padding: 10px 12px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: ui-monospace, 'JetBrains Mono', Consolas, monospace;
		font-size: 0.8rem;
		line-height: 1.5;
		tab-size: 4;
		resize: vertical;
		outline: none;
	}

	.css-editor:focus {
		border-color: var(--accent);
	}

	.css-help {
		margin-top: 8px;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.css-help summary {
		cursor: pointer;
		color: var(--text-secondary);
	}

	.css-help ul {
		margin: 6px 0 0 18px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.settings-section code {
		font-family: ui-monospace, Consolas, monospace;
		font-size: 0.9em;
		padding: 0 4px;
		border-radius: 4px;
		background: var(--bg-primary);
		color: var(--text-secondary);
	}

	.theme-file {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.file-btn {
		cursor: pointer;
	}

	.theme-message {
		margin-top: 8px;
		font-size: 0.8rem;
		color: var(--success);
	}

	.theme-message.error {
		color: var(--danger);
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
	.theme-preview[data-theme-preview="tmog"] { background: radial-gradient(circle at 80% 0%, rgba(22, 197, 255, 0.25), transparent 70%), #070b0f; color: #16c5ff; }
	.theme-preview[data-theme-preview="tmog-green"] { background: radial-gradient(circle at 80% 0%, rgba(69, 237, 115, 0.22), transparent 70%), #050a06; color: #45ed73; }
	.theme-preview[data-theme-preview="tmog-amber"] { background: radial-gradient(circle at 80% 0%, rgba(255, 179, 54, 0.22), transparent 70%), #0b0805; color: #ffb336; }
	.theme-preview[data-theme-preview="catppuccin-latte"] { background: #eff1f5; color: #4c4f69; }
	.theme-preview[data-theme-preview="catppuccin-frappe"] { background: #303446; color: #c6d0f5; }
	.theme-preview[data-theme-preview="rose-pine"] { background: #191724; color: #e0def4; }
	.theme-preview[data-theme-preview="everforest"] { background: #2d353b; color: #d3c6aa; }
	.theme-preview[data-theme-preview="kanagawa"] { background: #1f1f28; color: #dcd7ba; }
	.theme-preview[data-theme-preview="github-dark"] { background: #0d1117; color: #e6edf3; }
	.theme-preview[data-theme-preview="github-light"] { background: #f6f8fa; color: #1f2328; }
	.theme-preview[data-theme-preview="monokai"] { background: #272822; color: #f8f8f2; }
	.theme-preview[data-theme-preview="oled"] { background: #000000; color: #4f8fff; }
	.theme-preview[data-theme-preview="auto"] { background: linear-gradient(135deg, #0f0f1a 50%, #f0f2f5 50%); color: #4f8fff; }

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

	.section-hint {
		margin: -4px 0 10px;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.section-hint b {
		color: var(--warning);
		font-weight: 600;
	}

	.pair-picker {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
		margin-bottom: 12px;
	}

	.pair-dash {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.pair-dash select {
		padding: 7px 10px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		min-width: 180px;
	}

	.bp-tabs {
		display: flex;
		gap: 4px;
		padding: 3px;
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		border: 1px solid var(--border);
	}

	.bp-tab {
		position: relative;
		padding: 5px 12px;
		border-radius: calc(var(--radius-sm) - 2px);
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.bp-tab.active {
		color: white;
		background: var(--accent);
	}

	.bp-tab.edited::after {
		content: '';
		position: absolute;
		top: 3px;
		right: 3px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--warning);
	}

	.pair-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
	}

	.pair-grid fieldset {
		margin: 0;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	.pair-grid legend {
		padding: 0 6px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}

	.pair-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 12px 0 6px;
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

	/* Phone: full-screen sheet, tabs in a scrolling row on top, single-column forms. */
	@media (max-width: 640px) {
		.modal-header {
			padding: 12px 16px;
		}

		.modal-body {
			flex-direction: column;
		}

		.sidebar {
			flex-direction: row;
			width: auto;
			gap: 4px;
			padding: 6px 10px;
			border-right: none;
			border-bottom: 1px solid var(--border);
			overflow-x: auto;
			overflow-y: hidden;
			scrollbar-width: none;
			flex-shrink: 0;
		}

		.sidebar::-webkit-scrollbar {
			display: none;
		}

		.tab {
			flex-shrink: 0;
			padding: 9px 14px;
			border-left: none;
			border-bottom: 3px solid transparent;
			border-radius: var(--radius-sm) var(--radius-sm) 0 0;
			white-space: nowrap;
		}

		.tab.active {
			border-bottom-color: var(--accent);
		}

		.tab-content {
			padding: 16px;
		}

		.theme-grid {
			grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		}

		.palette-grid {
			grid-template-columns: 1fr 1fr;
		}

		.option-cards {
			flex-wrap: wrap;
		}

		.option-card {
			flex: 1 1 calc(50% - 10px);
		}

		.field-row {
			flex-wrap: wrap;
			gap: 6px 12px;
		}

		.field-row label {
			min-width: 0;
			flex-basis: 100%;
		}

		.pair-dash,
		.pair-dash select {
			min-width: 0;
			width: 100%;
		}

		.bp-tabs {
			overflow-x: auto;
			scrollbar-width: none;
		}

		.pair-grid {
			grid-template-columns: 1fr;
		}

		.breakpoint-row {
			flex-wrap: wrap;
		}

		.breakpoint-row .field-row {
			flex: 1 1 40%;
		}

		.modal-footer {
			padding: 12px 16px;
		}

		.modal-footer button {
			flex: 1;
		}
	}
</style>