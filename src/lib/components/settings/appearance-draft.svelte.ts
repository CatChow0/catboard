// Appearance being edited in Settings (theme, style, text, cards, background,
// custom CSS, theme files). The modal previews it live and saves it; the
// Appearance tab edits it.
import type { CustomPalette, Settings } from '$lib/types';
import { themePresets, customPaletteDefaults, themeDefaults, FONTS, isFontName, THEME_KEYS, cleanThemeFile, MAX_CUSTOM_CSS } from '$lib/themes';

const LIGHT = ['light', 'solarized-light', 'catppuccin-latte', 'github-light'];

export const darkPresets = themePresets.filter((t) => !LIGHT.includes(t.name));
export const lightPresets = themePresets.filter((t) => LIGHT.includes(t.name));

export const paletteLabels: Record<keyof CustomPalette, string> = {
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
	border: 'Border',
	borderLight: 'Border Light'
};

export class AppearanceDraft {
	theme = $state('dark');
	bgType = $state('none');
	bgValue = $state('');
	stylePreset = $state<Settings['stylePreset']>('default');
	animations = $state<Settings['animations']>('subtle');
	scrollbarStyle = $state<Settings['scrollbarStyle']>('thin');
	customPalette = $state<CustomPalette>({ ...customPaletteDefaults.dark });
	autoDark = $state('dark');
	autoLight = $state('light');
	radius = $state<number | undefined>(undefined);
	accent = $state('');
	fontChoice = $state('');
	otherFont = $state('');
	fontScale = $state(100);
	cardOpacity = $state(100);
	cardBlur = $state(0);
	customCss = $state('');
	message = $state<{ ok: boolean; text: string } | null>(null);

	/** The font to load: a known one, or a valid custom Google Fonts name. */
	font = $derived(this.fontChoice === 'other' ? (isFontName(this.otherFont.trim()) ? this.otherFont.trim() : '') : this.fontChoice);

	constructor(s: Settings) {
		this.theme = s.theme;
		this.bgType = s.background?.type || 'none';
		this.bgValue = s.background?.value || '';
		this.stylePreset = s.stylePreset || 'default';
		this.animations = s.animations || 'subtle';
		this.scrollbarStyle = s.scrollbarStyle || 'thin';
		this.customPalette = s.customPalette || { ...customPaletteDefaults.dark };
		this.autoDark = s.autoDark || 'dark';
		this.autoLight = s.autoLight || 'light';
		this.radius = s.radius;
		this.accent = s.accent || '';
		this.setFont(s.font);
		this.fontScale = s.fontScale ?? 100;
		this.cardOpacity = s.cardOpacity ?? 100;
		this.cardBlur = s.cardBlur ?? 0;
		this.customCss = s.customCss ?? '';
	}

	private setFont(font?: string) {
		this.fontChoice = !font ? '' : FONTS.includes(font) ? font : 'other';
		this.otherFont = font && !FONTS.includes(font) ? font : '';
	}

	/** Appearance fields as stored in settings (empty values left out). */
	values() {
		return {
			theme: this.theme,
			autoDark: this.theme === 'auto' ? this.autoDark : undefined,
			autoLight: this.theme === 'auto' ? this.autoLight : undefined,
			customPalette: this.theme === 'custom' ? $state.snapshot(this.customPalette) : undefined,
			background: { type: this.bgType, value: this.bgValue },
			stylePreset: this.stylePreset,
			animations: this.animations,
			scrollbarStyle: this.scrollbarStyle,
			radius: this.radius,
			accent: this.accent || undefined,
			font: this.font || undefined,
			fontScale: this.fontScale !== 100 ? this.fontScale : undefined,
			cardOpacity: this.cardOpacity < 100 ? this.cardOpacity : undefined,
			cardBlur: this.cardBlur > 0 ? this.cardBlur : undefined,
			customCss: this.customCss.trim() ? this.customCss.slice(0, MAX_CUSTOM_CSS) : undefined
		};
	}

	applyTheme(name: string) {
		if (name === 'custom') {
			const base = this.theme === 'custom' ? 'dark' : this.theme;
			this.customPalette = { ...(customPaletteDefaults[base] || customPaletteDefaults.dark) };
		} else if (name !== 'auto') {
			const defaults = themeDefaults[name];
			if (defaults) {
				this.stylePreset = defaults.stylePreset;
				this.scrollbarStyle = defaults.scrollbarStyle;
			}
		}
		this.theme = name;
	}

	/** A style card resets a custom corner radius. */
	pickStyle(preset: Settings['stylePreset']) {
		this.stylePreset = preset;
		this.radius = undefined;
	}

	resetPalette() {
		const base = customPaletteDefaults[this.theme] ? this.theme : 'dark';
		this.customPalette = { ...customPaletteDefaults[base] };
	}

	exportFile() {
		const data: Record<string, unknown> = { catboardTheme: 1 };
		const values = this.values() as Record<string, unknown>;
		for (const k of THEME_KEYS) if (values[k] !== undefined) data[k] = values[k];
		const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = `catboard-theme-${this.theme}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async importFile(file: File) {
		try {
			const t = cleanThemeFile(JSON.parse(await file.text()));
			if (t.customPalette) this.customPalette = t.customPalette;
			if (t.theme) this.theme = t.theme;
			this.autoDark = t.autoDark ?? 'dark';
			this.autoLight = t.autoLight ?? 'light';
			if (t.stylePreset) this.stylePreset = t.stylePreset;
			if (t.animations) this.animations = t.animations;
			if (t.scrollbarStyle) this.scrollbarStyle = t.scrollbarStyle;
			if (t.background) {
				this.bgType = t.background.type;
				this.bgValue = t.background.value;
			}
			this.radius = t.radius;
			this.accent = t.accent ?? '';
			this.setFont(t.font);
			this.fontScale = t.fontScale ?? 100;
			this.cardOpacity = t.cardOpacity ?? 100;
			this.cardBlur = t.cardBlur ?? 0;
			this.customCss = t.customCss ?? '';
			this.message = { ok: true, text: `Theme "${file.name}" applied: Save to keep it.` };
		} catch (err) {
			this.message = { ok: false, text: err instanceof Error && !(err instanceof SyntaxError) ? err.message : 'This file is not valid JSON' };
		}
	}
}
