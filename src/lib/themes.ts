import type { CustomPalette } from './stores/dashboard';
import type { Settings } from './types';

export interface ThemePreset {
	name: string;
	label: string;
}

export const themePresets: ThemePreset[] = [
	{ name: 'dark', label: 'Dark' },
	{ name: 'light', label: 'Light' },
	{ name: 'nord', label: 'Nord' },
	{ name: 'dracula', label: 'Dracula' },
	{ name: 'solarized-dark', label: 'Solarized Dark' },
	{ name: 'solarized-light', label: 'Solarized Light' },
	{ name: 'catppuccin-mocha', label: 'Catppuccin Mocha' },
	{ name: 'gruvbox-dark', label: 'Gruvbox Dark' },
	{ name: 'one-dark', label: 'One Dark' },
	{ name: 'tokyo-night', label: 'Tokyo Night' },
	{ name: 'tmog', label: 'TMOG' },
	{ name: 'tmog-green', label: 'TMOG Green' },
	{ name: 'tmog-amber', label: 'TMOG Amber' },
	{ name: 'catppuccin-latte', label: 'Catppuccin Latte' },
	{ name: 'catppuccin-frappe', label: 'Catppuccin Frappé' },
	{ name: 'rose-pine', label: 'Rosé Pine' },
	{ name: 'everforest', label: 'Everforest' },
	{ name: 'kanagawa', label: 'Kanagawa' },
	{ name: 'github-dark', label: 'GitHub Dark' },
	{ name: 'github-light', label: 'GitHub Light' },
	{ name: 'monokai', label: 'Monokai' },
	{ name: 'oled', label: 'OLED Black' }
];

export const customPaletteDefaults: Record<string, CustomPalette> = {
	'dark': {
		bgPrimary: '#0f0f1a', bgSecondary: '#1a1a2e', bgCard: '#16213e', bgCardHover: '#1a2745',
		bgModal: '#1a1a2e', textPrimary: '#e0e0e0', textSecondary: '#a0a0b0', textMuted: '#6c6c80',
		accent: '#4f8fff', accentHover: '#6fa0ff', danger: '#ff4f6f', success: '#4fdd8f',
		warning: '#ffbf4f', border: '#2a2a40', borderLight: '#3a3a55'
	},
	'light': {
		bgPrimary: '#f0f2f5', bgSecondary: '#ffffff', bgCard: '#ffffff', bgCardHover: '#f5f7fa',
		bgModal: '#ffffff', textPrimary: '#1a1a2e', textSecondary: '#4a4a5a', textMuted: '#8a8a9a',
		accent: '#3070d0', accentHover: '#5090f0', danger: '#e0365a', success: '#2db86a',
		warning: '#e0a030', border: '#d8dce5', borderLight: '#e8ecf2'
	},
	'nord': {
		bgPrimary: '#2e3440', bgSecondary: '#3b4252', bgCard: '#434c5e', bgCardHover: '#4c566a',
		bgModal: '#3b4252', textPrimary: '#eceff4', textSecondary: '#d8dee9', textMuted: '#81a1c1',
		accent: '#88c0d0', accentHover: '#8fbcbb', danger: '#bf616a', success: '#a3be8c',
		warning: '#ebcb8b', border: '#434c5e', borderLight: '#4c566a'
	},
	'dracula': {
		bgPrimary: '#282a36', bgSecondary: '#44475a', bgCard: '#343746', bgCardHover: '#44475a',
		bgModal: '#282a36', textPrimary: '#f8f8f2', textSecondary: '#bd93f9', textMuted: '#6272a4',
		accent: '#bd93f9', accentHover: '#caa8fb', danger: '#ff5555', success: '#50fa7b',
		warning: '#f1fa8c', border: '#44475a', borderLight: '#6272a4'
	},
	'solarized-dark': {
		bgPrimary: '#002b36', bgSecondary: '#073642', bgCard: '#0a3a4a', bgCardHover: '#0d4a5a',
		bgModal: '#073642', textPrimary: '#fdf6e3', textSecondary: '#93a1a1', textMuted: '#586e75',
		accent: '#268bd2', accentHover: '#2aa198', danger: '#dc322f', success: '#859900',
		warning: '#b58900', border: '#073642', borderLight: '#0a3a4a'
	},
	'solarized-light': {
		bgPrimary: '#fdf6e3', bgSecondary: '#eee8d5', bgCard: '#eee8d5', bgCardHover: '#e0dac7',
		bgModal: '#eee8d5', textPrimary: '#073642', textSecondary: '#586e75', textMuted: '#93a1a1',
		accent: '#268bd2', accentHover: '#2aa198', danger: '#dc322f', success: '#859900',
		warning: '#b58900', border: '#d0c9b4', borderLight: '#e0dac7'
	},
	'catppuccin-mocha': {
		bgPrimary: '#1e1e2e', bgSecondary: '#181825', bgCard: '#313244', bgCardHover: '#45475a',
		bgModal: '#181825', textPrimary: '#cdd6f4', textSecondary: '#bac2de', textMuted: '#6c7086',
		accent: '#cba6f7', accentHover: '#b4befe', danger: '#f38ba8', success: '#a6e3a1',
		warning: '#f9e2af', border: '#313244', borderLight: '#45475a'
	},
	'gruvbox-dark': {
		bgPrimary: '#282828', bgSecondary: '#1d2021', bgCard: '#3c3836', bgCardHover: '#504945',
		bgModal: '#1d2021', textPrimary: '#ebdbb2', textSecondary: '#bdae93', textMuted: '#665c54',
		accent: '#fe8019', accentHover: '#fabd2f', danger: '#fb4934', success: '#b8bb26',
		warning: '#fabd2f', border: '#3c3836', borderLight: '#504945'
	},
	'one-dark': {
		bgPrimary: '#282c34', bgSecondary: '#21252b', bgCard: '#2c313a', bgCardHover: '#3e4451',
		bgModal: '#21252b', textPrimary: '#abb2bf', textSecondary: '#8389a5', textMuted: '#5c6370',
		accent: '#61afef', accentHover: '#56b6c2', danger: '#e06c75', success: '#98c379',
		warning: '#e5c07b', border: '#3e4451', borderLight: '#4b5263'
	},
	'tokyo-night': {
		bgPrimary: '#1a1b26', bgSecondary: '#16161e', bgCard: '#24283b', bgCardHover: '#292e42',
		bgModal: '#16161e', textPrimary: '#c0caf5', textSecondary: '#a9b1d6', textMuted: '#565f89',
		accent: '#7aa2f7', accentHover: '#7dcfff', danger: '#f7768e', success: '#9ece6a',
		warning: '#e0af68', border: '#292e42', borderLight: '#3b4261'
	},
	'tmog': {
		bgPrimary: '#070b0f', bgSecondary: '#0b1117', bgCard: '#0e151c', bgCardHover: '#111a22',
		bgModal: '#0b1117', textPrimary: '#edf5fa', textSecondary: '#91a1ac', textMuted: '#60717d',
		accent: '#16c5ff', accentHover: '#6edcff', danger: '#ff4f55', success: '#45ed73',
		warning: '#ffe016', border: '#1c262e', borderLight: '#2a3a45'
	},
	'tmog-green': {
		bgPrimary: '#050a06', bgSecondary: '#08100a', bgCard: '#0b160e', bgCardHover: '#0f1d13',
		bgModal: '#08100a', textPrimary: '#b8ffca', textSecondary: '#6fc488', textMuted: '#3f7a52',
		accent: '#45ed73', accentHover: '#86ff35', danger: '#ff4f55', success: '#86ff35',
		warning: '#ffe016', border: '#16301e', borderLight: '#21452b'
	},
	'tmog-amber': {
		bgPrimary: '#0b0805', bgSecondary: '#120d07', bgCard: '#18110a', bgCardHover: '#20170d',
		bgModal: '#120d07', textPrimary: '#ffd99a', textSecondary: '#c99a55', textMuted: '#7d6038',
		accent: '#ffb336', accentHover: '#ffcb6b', danger: '#ff4f55', success: '#45ed73',
		warning: '#ff8a22', border: '#33240f', borderLight: '#4a3517'
	},
	'catppuccin-latte': {
		bgPrimary: '#eff1f5', bgSecondary: '#e6e9ef', bgCard: '#e6e9ef', bgCardHover: '#dce0e8',
		bgModal: '#eff1f5', textPrimary: '#4c4f69', textSecondary: '#5c5f77', textMuted: '#9ca0b0',
		accent: '#8839ef', accentHover: '#7287fd', danger: '#d20f39', success: '#40a02b', warning: '#df8e1d',
		border: '#ccd0da', borderLight: '#bcc0cc'
	},
	'catppuccin-frappe': {
		bgPrimary: '#303446', bgSecondary: '#292c3c', bgCard: '#414559', bgCardHover: '#51576d',
		bgModal: '#292c3c', textPrimary: '#c6d0f5', textSecondary: '#b5bfe2', textMuted: '#737994',
		accent: '#ca9ee6', accentHover: '#babbf1', danger: '#e78284', success: '#a6d189', warning: '#e5c890',
		border: '#414559', borderLight: '#51576d'
	},
	'rose-pine': {
		bgPrimary: '#191724', bgSecondary: '#1f1d2e', bgCard: '#1f1d2e', bgCardHover: '#26233a',
		bgModal: '#1f1d2e', textPrimary: '#e0def4', textSecondary: '#908caa', textMuted: '#6e6a86',
		accent: '#c4a7e7', accentHover: '#ebbcba', danger: '#eb6f92', success: '#9ccfd8', warning: '#f6c177',
		border: '#26233a', borderLight: '#403d52'
	},
	'everforest': {
		bgPrimary: '#2d353b', bgSecondary: '#232a2e', bgCard: '#343f44', bgCardHover: '#3d484d',
		bgModal: '#232a2e', textPrimary: '#d3c6aa', textSecondary: '#9da9a0', textMuted: '#7a8478',
		accent: '#a7c080', accentHover: '#83c092', danger: '#e67e80', success: '#a7c080', warning: '#dbbc7f',
		border: '#3d484d', borderLight: '#475258'
	},
	'kanagawa': {
		bgPrimary: '#1f1f28', bgSecondary: '#16161d', bgCard: '#2a2a37', bgCardHover: '#363646',
		bgModal: '#16161d', textPrimary: '#dcd7ba', textSecondary: '#c8c093', textMuted: '#727169',
		accent: '#7e9cd8', accentHover: '#7fb4ca', danger: '#e46876', success: '#98bb6c', warning: '#e6c384',
		border: '#2a2a37', borderLight: '#54546d'
	},
	'github-dark': {
		bgPrimary: '#0d1117', bgSecondary: '#010409', bgCard: '#161b22', bgCardHover: '#1c2128',
		bgModal: '#161b22', textPrimary: '#e6edf3', textSecondary: '#8b949e', textMuted: '#6e7681',
		accent: '#2f81f7', accentHover: '#58a6ff', danger: '#f85149', success: '#3fb950', warning: '#d29922',
		border: '#30363d', borderLight: '#484f58'
	},
	'github-light': {
		bgPrimary: '#f6f8fa', bgSecondary: '#ffffff', bgCard: '#ffffff', bgCardHover: '#f3f4f6',
		bgModal: '#ffffff', textPrimary: '#1f2328', textSecondary: '#656d76', textMuted: '#8c959f',
		accent: '#0969da', accentHover: '#218bff', danger: '#cf222e', success: '#1a7f37', warning: '#9a6700',
		border: '#d0d7de', borderLight: '#e5e8eb'
	},
	'monokai': {
		bgPrimary: '#272822', bgSecondary: '#1e1f1c', bgCard: '#2d2e27', bgCardHover: '#3e3d32',
		bgModal: '#1e1f1c', textPrimary: '#f8f8f2', textSecondary: '#cfcfc2', textMuted: '#75715e',
		accent: '#66d9ef', accentHover: '#8be6f5', danger: '#f92672', success: '#a6e22e', warning: '#fd971f',
		border: '#3e3d32', borderLight: '#49483e'
	},
	'oled': {
		bgPrimary: '#000000', bgSecondary: '#0a0a0a', bgCard: '#0d0d0d', bgCardHover: '#161616',
		bgModal: '#0a0a0a', textPrimary: '#e8e8e8', textSecondary: '#a0a0a0', textMuted: '#666666',
		accent: '#4f8fff', accentHover: '#6fa0ff', danger: '#ff4f6f', success: '#4fdd8f', warning: '#ffbf4f',
		border: '#1f1f1f', borderLight: '#2c2c2c'
	}
};

export interface ThemeDefaults {
	stylePreset: 'default' | 'sharp' | 'pill';
	scrollbarStyle: 'thin' | 'hidden' | 'wide';
}

export const themeDefaults: Record<string, ThemeDefaults> = {
	'dark': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'light': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'nord': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'dracula': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'solarized-dark': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'solarized-light': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'catppuccin-mocha': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'gruvbox-dark': { stylePreset: 'sharp', scrollbarStyle: 'thin' },
	'one-dark': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'tokyo-night': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'tmog': { stylePreset: 'sharp', scrollbarStyle: 'thin' },
	'tmog-green': { stylePreset: 'sharp', scrollbarStyle: 'thin' },
	'tmog-amber': { stylePreset: 'sharp', scrollbarStyle: 'thin' },
	'catppuccin-latte': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'catppuccin-frappe': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'rose-pine': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'everforest': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'kanagawa': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'github-dark': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'github-light': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'monokai': { stylePreset: 'default', scrollbarStyle: 'thin' },
	'oled': { stylePreset: 'default', scrollbarStyle: 'thin' }
};
// --- Appearance options on top of the theme ---------------------------------

/** Fonts offered in the picker (loaded from Google Fonts when chosen). */
export const FONTS = ['Inter', 'Roboto', 'Nunito', 'Poppins', 'Fira Sans', 'JetBrains Mono'];

/** A Google Fonts family name: letters, digits and spaces only. */
export const isFontName = (name: string) => /^[A-Za-z0-9 ]{1,40}$/.test(name);

export function fontHref(name: string): string {
	return `https://fonts.googleapis.com/css2?family=${name.trim().replace(/ +/g, '+')}:wght@400;500;600;700&display=swap`;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The preset on screen: 'auto' follows the system between two presets. */
export function effectiveTheme(s: Pick<Settings, 'theme' | 'autoDark' | 'autoLight'>, prefersDark: boolean): string {
	if (s.theme !== 'auto') return s.theme;
	return prefersDark ? s.autoDark || 'dark' : s.autoLight || 'light';
}

/** Colours of a theme (the user's own palette for 'custom'). */
export function paletteOf(theme: string, custom?: CustomPalette): CustomPalette {
	return (theme === 'custom' && custom) || customPaletteDefaults[theme] || customPaletteDefaults.dark;
}

const cssVar = (key: string) => `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;

/** Inline CSS variables for the custom palette, radius, accent, glass cards and font. */
export function appearanceStyle(s: Settings, theme: string): string {
	const out: string[] = [];
	if (theme === 'custom' && s.customPalette) {
		for (const [k, v] of Object.entries(s.customPalette)) if (HEX.test(v)) out.push(`${cssVar(k)}: ${v}`);
	}
	if (typeof s.radius === 'number') {
		const r = Math.max(0, Math.min(24, Math.round(s.radius)));
		out.push(`--radius: ${r}px`, `--radius-sm: ${Math.round(r * 0.66)}px`, `--radius-lg: ${Math.round(r * 1.33)}px`);
	}
	if (s.accent && HEX.test(s.accent)) {
		const a = s.accent;
		out.push(`--accent: ${a}`, `--accent-hover: color-mix(in srgb, ${a} 80%, white)`, `--accent-glow: color-mix(in srgb, ${a} 18%, transparent)`, `--accent-bg: color-mix(in srgb, ${a} 6%, transparent)`);
	}
	const opacity = Math.max(40, Math.min(100, s.cardOpacity ?? 100));
	if (opacity < 100) {
		const p = paletteOf(theme, s.customPalette);
		out.push(`--bg-card: color-mix(in srgb, ${p.bgCard} ${opacity}%, transparent)`, `--bg-card-hover: color-mix(in srgb, ${p.bgCardHover} ${opacity}%, transparent)`);
	}
	const blur = Math.max(0, Math.min(20, s.cardBlur ?? 0));
	if (blur > 0) out.push(`--card-blur: ${blur}px`);
	if (s.font && isFontName(s.font)) out.push(`font-family: '${s.font}', system-ui, sans-serif`);
	return out.join('; ');
}

// --- Theme files (export / import) ------------------------------------------

/** Settings a theme file carries. */
export const THEME_KEYS = ['theme', 'customPalette', 'autoDark', 'autoLight', 'stylePreset', 'radius', 'accent', 'font', 'fontScale', 'cardOpacity', 'cardBlur', 'animations', 'scrollbarStyle', 'background', 'customCss'] as const;
export type ThemeFile = Partial<Pick<Settings, (typeof THEME_KEYS)[number]>>;

const presetNames = () => new Set([...themePresets.map((t) => t.name), 'custom', 'auto']);
const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && v >= min && v <= max ? v : undefined);

/** Keeps the known, well-formed keys of an imported theme file; throws when nothing usable is left. */
export function cleanThemeFile(raw: unknown): ThemeFile {
	if (!raw || typeof raw !== 'object') throw new Error('Not a theme file');
	const r = raw as Record<string, unknown>;
	const out: ThemeFile = {};
	const names = presetNames();
	if (typeof r.theme === 'string' && names.has(r.theme)) out.theme = r.theme;
	if (typeof r.autoDark === 'string' && names.has(r.autoDark)) out.autoDark = r.autoDark;
	if (typeof r.autoLight === 'string' && names.has(r.autoLight)) out.autoLight = r.autoLight;
	if (r.customPalette && typeof r.customPalette === 'object') {
		const p = r.customPalette as Record<string, unknown>;
		const keys = Object.keys(customPaletteDefaults.dark) as (keyof CustomPalette)[];
		if (keys.every((k) => typeof p[k] === 'string' && HEX.test(p[k] as string))) out.customPalette = Object.fromEntries(keys.map((k) => [k, p[k]])) as unknown as CustomPalette;
	}
	if (r.stylePreset === 'default' || r.stylePreset === 'sharp' || r.stylePreset === 'pill') out.stylePreset = r.stylePreset;
	if (r.animations === 'none' || r.animations === 'subtle' || r.animations === 'full') out.animations = r.animations;
	if (r.scrollbarStyle === 'thin' || r.scrollbarStyle === 'hidden' || r.scrollbarStyle === 'wide') out.scrollbarStyle = r.scrollbarStyle;
	out.radius = num(r.radius, 0, 24);
	out.fontScale = num(r.fontScale, 90, 120);
	out.cardOpacity = num(r.cardOpacity, 40, 100);
	out.cardBlur = num(r.cardBlur, 0, 20);
	if (typeof r.accent === 'string' && HEX.test(r.accent)) out.accent = r.accent;
	if (typeof r.font === 'string' && (r.font === '' || isFontName(r.font))) out.font = r.font;
	if (r.background && typeof r.background === 'object') {
		const b = r.background as Record<string, unknown>;
		if ((b.type === 'none' || b.type === 'image') && typeof b.value === 'string') out.background = { type: b.type, value: b.value.slice(0, 2000) };
	}
	if (typeof r.customCss === 'string') out.customCss = r.customCss.slice(0, MAX_CUSTOM_CSS);
	for (const k of Object.keys(out) as (keyof ThemeFile)[]) if (out[k] === undefined) delete out[k];
	if (Object.keys(out).length === 0) throw new Error('No theme settings found in this file');
	return out;
}

export const MAX_CUSTOM_CSS = 50_000;
