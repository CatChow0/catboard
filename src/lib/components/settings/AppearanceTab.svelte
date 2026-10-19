<script lang="ts">
	// Settings > Appearance: edits the modal's AppearanceDraft (previewed live,
	// saved by the modal's Save button). Styles: settings.css.
	import type { CustomPalette } from '$lib/types';
	import { themePresets, FONTS, MAX_CUSTOM_CSS } from '$lib/themes';
	import { darkPresets, lightPresets, paletteLabels, type AppearanceDraft } from './appearance-draft.svelte';

	let { draft }: { draft: AppearanceDraft } = $props();

	/** Tab in the CSS editor indents instead of leaving the field. */
	function cssKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab' || e.shiftKey) return;
		e.preventDefault();
		const el = e.currentTarget as HTMLTextAreaElement;
		const { selectionStart: a, selectionEnd: b } = el;
		draft.customCss = draft.customCss.slice(0, a) + '\t' + draft.customCss.slice(b);
		requestAnimationFrame(() => el.setSelectionRange(a + 1, a + 1));
	}

	function importTheme(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) draft.importFile(file);
	}
</script>

<div class="settings-section">
	<h3>Color Theme</h3>
	<div class="theme-grid">
		{#each themePresets as preset}
			<button class="theme-card" class:active={draft.theme === preset.name} onclick={() => draft.applyTheme(preset.name)}>
				<div class="theme-preview" data-theme-preview={preset.name}>
					<span class="theme-label">{preset.label}</span>
				</div>
			</button>
		{/each}
		<button class="theme-card" class:active={draft.theme === 'auto'} onclick={() => draft.applyTheme('auto')}>
			<div class="theme-preview" data-theme-preview="auto">
				<span class="theme-label">Auto</span>
			</div>
		</button>
		<button class="theme-card" class:active={draft.theme === 'custom'} onclick={() => draft.applyTheme('custom')}>
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

{#if draft.theme === 'auto'}
	<div class="settings-section">
		<h3>Auto theme</h3>
		<p class="section-hint">Follows the light or dark mode of the device.</p>
		<div class="field-row">
			<label for="auto-dark">Dark mode</label>
			<select id="auto-dark" bind:value={draft.autoDark}>
				{#each darkPresets as t}<option value={t.name}>{t.label}</option>{/each}
			</select>
		</div>
		<div class="field-row">
			<label for="auto-light">Light mode</label>
			<select id="auto-light" bind:value={draft.autoLight}>
				{#each lightPresets as t}<option value={t.name}>{t.label}</option>{/each}
			</select>
		</div>
	</div>
{/if}

{#if draft.theme === 'custom'}
	<div class="settings-section">
		<div class="section-header">
			<h3>Custom Palette</h3>
			<button class="btn-reset" onclick={() => draft.resetPalette()}>Reset</button>
		</div>
		<div class="palette-grid">
			{#each Object.entries(paletteLabels) as [key, label]}
				<div class="palette-row">
					<label for="pal-{key}">{label}</label>
					<input id="pal-{key}" type="color" bind:value={draft.customPalette[key as keyof CustomPalette]} />
				</div>
			{/each}
		</div>
	</div>
{/if}

<div class="settings-section">
	<h3>Style</h3>
	<div class="option-cards">
		{#each [['default', 'Rounded'], ['sharp', 'Sharp'], ['pill', 'Pill']] as const as [preset, label]}
			<button class="option-card" class:active={draft.stylePreset === preset && draft.radius === undefined} onclick={() => draft.pickStyle(preset)}>
				<div class="option-preview">
					<div class="style-box {preset}-box"></div>
				</div>
				<span>{label}</span>
			</button>
		{/each}
	</div>
	<div class="range-row">
		<label for="radius">Corner radius</label>
		<input id="radius" type="range" min="0" max="24" step="1" value={draft.radius ?? (draft.stylePreset === 'sharp' ? 4 : draft.stylePreset === 'pill' ? 20 : 12)} oninput={(e) => (draft.radius = Number(e.currentTarget.value))} />
		<span class="range-value">{draft.radius === undefined ? 'Preset' : `${draft.radius}px`}</span>
	</div>
</div>

<div class="settings-section">
	<h3>Text</h3>
	<div class="field-row">
		<label for="font">Font</label>
		<select id="font" bind:value={draft.fontChoice}>
			<option value="">System</option>
			{#each FONTS as f}<option value={f}>{f}</option>{/each}
			<option value="other">Other Google font…</option>
		</select>
	</div>
	{#if draft.fontChoice === 'other'}
		<div class="field-row">
			<label for="other-font">Font name</label>
			<input id="other-font" type="text" bind:value={draft.otherFont} placeholder="e.g. Space Grotesk" maxlength="40" />
		</div>
		{#if draft.otherFont.trim() && !draft.font}<p class="section-hint"><b>Letters, digits and spaces only.</b></p>{/if}
	{/if}
	{#if draft.font}<p class="section-hint">Loaded from Google Fonts.</p>{/if}
	<div class="range-row">
		<label for="font-scale">Text size</label>
		<input id="font-scale" type="range" min="90" max="120" step="5" bind:value={draft.fontScale} />
		<span class="range-value">{draft.fontScale}%</span>
	</div>
</div>

<div class="settings-section">
	<h3>Cards</h3>
	<div class="range-row">
		<label for="accent-on">Accent color</label>
		<span class="cb-form">
			<label class="toggle-switch" style="margin: 0">
				<input id="accent-on" type="checkbox" checked={!!draft.accent} onchange={(e) => (draft.accent = e.currentTarget.checked ? '#4f8fff' : '')} />
				<span class="toggle-slider"></span>
			</label>
		</span>
		{#if draft.accent}
			<input class="accent-input" type="color" bind:value={draft.accent} aria-label="Accent color" />
		{:else}
			<span class="range-value">From theme</span>
		{/if}
	</div>
	<div class="range-row">
		<label for="card-opacity">Opacity</label>
		<input id="card-opacity" type="range" min="40" max="100" step="5" bind:value={draft.cardOpacity} />
		<span class="range-value">{draft.cardOpacity}%</span>
	</div>
	<div class="range-row">
		<label for="card-blur">Blur</label>
		<input id="card-blur" type="range" min="0" max="20" step="1" bind:value={draft.cardBlur} />
		<span class="range-value">{draft.cardBlur ? `${draft.cardBlur}px` : 'Off'}</span>
	</div>
	<p class="section-hint">See-through, blurred cards look best over a background image.</p>
</div>

<div class="settings-section">
	<h3>Animations</h3>
	<div class="option-cards">
		<button class="option-card" class:active={draft.animations === 'none'} onclick={() => (draft.animations = 'none')}>
			<div class="anim-preview">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
				</svg>
			</div>
			<span>None</span>
		</button>
		<button class="option-card" class:active={draft.animations === 'subtle'} onclick={() => (draft.animations = 'subtle')}>
			<div class="anim-preview">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
				</svg>
			</div>
			<span>Subtle</span>
		</button>
		<button class="option-card" class:active={draft.animations === 'full'} onclick={() => (draft.animations = 'full')}>
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
		{#each [['thin', 'Thin'], ['wide', 'Wide'], ['hidden', 'Hidden']] as const as [style, label]}
			<button class="option-card" class:active={draft.scrollbarStyle === style} onclick={() => (draft.scrollbarStyle = style)}>
				<div class="scroll-preview {style}-scroll"></div>
				<span>{label}</span>
			</button>
		{/each}
	</div>
</div>

<div class="settings-section">
	<h3>Background</h3>
	<div class="field-row">
		<label for="bg-type">Type</label>
		<select id="bg-type" bind:value={draft.bgType}>
			<option value="none">None (use theme)</option>
			<option value="image">Image URL</option>
		</select>
	</div>
	{#if draft.bgType === 'image'}
		<div class="field-row">
			<label for="bg-url">Image URL</label>
			<input id="bg-url" type="text" bind:value={draft.bgValue} placeholder="https://..." />
		</div>
	{/if}
</div>

<div class="settings-section">
	<div class="section-header">
		<h3>Custom CSS</h3>
		{#if draft.customCss}<button class="btn-reset" onclick={() => (draft.customCss = '')}>Clear</button>{/if}
	</div>
	<p class="section-hint">Applied live, only for your account. Broken page? Open CatBoard with <code>?nocss</code> at the end of the address to skip it.</p>
	<textarea class="css-editor" bind:value={draft.customCss} onkeydown={cssKeydown} spellcheck="false" maxlength={MAX_CUSTOM_CSS} aria-label="Custom CSS" placeholder={'.cb-item-clock {\n\tborder: 1px solid var(--accent);\n}'}></textarea>
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
		<button class="btn-reset" onclick={() => draft.exportFile()}>Export theme</button>
		<label class="btn-reset file-btn">
			Import theme
			<input type="file" accept="application/json,.json" onchange={importTheme} hidden />
		</label>
	</div>
	{#if draft.message}<p class="theme-message" class:error={!draft.message.ok}>{draft.message.text}</p>{/if}
</div>
