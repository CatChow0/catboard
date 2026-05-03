import type { CustomPalette } from './stores/dashboard';

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
	{ name: 'tokyo-night', label: 'Tokyo Night' }
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
	'tokyo-night': { stylePreset: 'default', scrollbarStyle: 'thin' }
};