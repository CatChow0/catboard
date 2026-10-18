import { describe, expect, it } from 'vitest';
import type { Settings } from './types';
import {
	themePresets, customPaletteDefaults, themeDefaults, effectiveTheme, paletteOf, appearanceStyle,
	cleanThemeFile, isFontName, fontHref, MAX_CUSTOM_CSS
} from './themes';

const base = { theme: 'dark', background: { type: 'none', value: '' } } as Settings;
const style = (extra: Partial<Settings>, theme = 'dark') => appearanceStyle({ ...base, ...extra }, theme);

describe('presets', () => {
	it('every preset has a palette and defaults', () => {
		for (const p of themePresets) {
			expect(customPaletteDefaults[p.name], p.name).toBeDefined();
			expect(themeDefaults[p.name], p.name).toBeDefined();
		}
	});
	it('every palette has the 15 colours as #rrggbb', () => {
		const keys = Object.keys(customPaletteDefaults.dark);
		expect(keys).toHaveLength(15);
		for (const [name, pal] of Object.entries(customPaletteDefaults)) {
			expect(Object.keys(pal).sort(), name).toEqual([...keys].sort());
			for (const v of Object.values(pal)) expect(v, name).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});
	it('names are unique', () => {
		const names = themePresets.map((p) => p.name);
		expect(new Set(names).size).toBe(names.length);
	});
});

describe('effectiveTheme', () => {
	it('returns fixed themes as they are', () => {
		expect(effectiveTheme({ theme: 'nord' }, true)).toBe('nord');
	});
	it('auto follows the colour scheme, with dark / light by default', () => {
		expect(effectiveTheme({ theme: 'auto', autoDark: 'kanagawa', autoLight: 'github-light' }, true)).toBe('kanagawa');
		expect(effectiveTheme({ theme: 'auto', autoDark: 'kanagawa', autoLight: 'github-light' }, false)).toBe('github-light');
		expect(effectiveTheme({ theme: 'auto' }, true)).toBe('dark');
		expect(effectiveTheme({ theme: 'auto' }, false)).toBe('light');
	});
});

describe('paletteOf', () => {
	it('uses the custom palette only for the custom theme', () => {
		const custom = { ...customPaletteDefaults.dark, accent: '#123456' };
		expect(paletteOf('custom', custom).accent).toBe('#123456');
		expect(paletteOf('nord', custom)).toBe(customPaletteDefaults.nord);
		expect(paletteOf('unknown')).toBe(customPaletteDefaults.dark);
	});
});

describe('appearanceStyle', () => {
	it('is empty with default settings', () => {
		expect(style({})).toBe('');
	});
	it('turns the custom palette into CSS variables, skipping bad values', () => {
		const css = style({ customPalette: { ...customPaletteDefaults.dark, bgCard: '#010203', accent: 'red;}body{x' } }, 'custom');
		expect(css).toContain('--bg-card: #010203');
		expect(css).not.toContain('red;}');
	});
	it('clamps the radius and derives the small and large radii', () => {
		expect(style({ radius: 12 })).toContain('--radius: 12px; --radius-sm: 8px; --radius-lg: 16px');
		expect(style({ radius: 99 })).toContain('--radius: 24px');
		expect(style({ radius: -3 })).toContain('--radius: 0px');
	});
	it('derives the accent shades and ignores invalid colours', () => {
		expect(style({ accent: '#ff00aa' })).toContain('--accent: #ff00aa; --accent-hover: color-mix(in srgb, #ff00aa 80%, white)');
		expect(style({ accent: 'url(x)' })).toBe('');
	});
	it('mixes the card colours for opacity and sets the blur', () => {
		const css = style({ cardOpacity: 60, cardBlur: 8 }, 'nord');
		expect(css).toContain(`--bg-card: color-mix(in srgb, ${customPaletteDefaults.nord.bgCard} 60%, transparent)`);
		expect(css).toContain('--card-blur: 8px');
		expect(style({ cardOpacity: 10 })).toContain(' 40%, transparent');
		expect(style({ cardOpacity: 100, cardBlur: 0 })).toBe('');
	});
	it('only accepts safe font names', () => {
		expect(style({ font: 'Fira Sans' })).toContain("font-family: 'Fira Sans', system-ui, sans-serif");
		expect(style({ font: "x'; } body { color: red" })).toBe('');
	});
});

describe('fonts', () => {
	it('isFontName accepts letters, digits and spaces', () => {
		expect(isFontName('JetBrains Mono')).toBe(true);
		expect(isFontName('Bad<Font>')).toBe(false);
		expect(isFontName('')).toBe(false);
	});
	it('fontHref builds a Google Fonts URL', () => {
		expect(fontHref('Space  Grotesk')).toBe('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
	});
});

describe('cleanThemeFile', () => {
	it('keeps the valid keys of an exported theme', () => {
		const t = cleanThemeFile({
			catboardTheme: 1,
			theme: 'auto',
			autoDark: 'kanagawa',
			autoLight: 'github-light',
			radius: 0,
			accent: '#ff00aa',
			font: 'Inter',
			fontScale: 110,
			cardOpacity: 60,
			cardBlur: 8,
			animations: 'none',
			scrollbarStyle: 'hidden',
			stylePreset: 'pill',
			background: { type: 'image', value: 'https://x/y.jpg' },
			customCss: '.a{}'
		});
		expect(t).toEqual({
			theme: 'auto', autoDark: 'kanagawa', autoLight: 'github-light', radius: 0, accent: '#ff00aa', font: 'Inter', fontScale: 110,
			cardOpacity: 60, cardBlur: 8, animations: 'none', scrollbarStyle: 'hidden', stylePreset: 'pill',
			background: { type: 'image', value: 'https://x/y.jpg' }, customCss: '.a{}'
		});
	});
	it('drops unknown themes, bad colours, out-of-range numbers and foreign keys', () => {
		const t = cleanThemeFile({ theme: 'hacker', accent: 'red', radius: 100, cardBlur: -1, fontScale: 300, font: '<x>', foo: 1, stylePreset: 'round', customCss: 'ok' });
		expect(t).toEqual({ customCss: 'ok' });
	});
	it('keeps a custom palette only when it is complete and valid', () => {
		expect(cleanThemeFile({ theme: 'custom', customPalette: customPaletteDefaults.dracula }).customPalette).toEqual(customPaletteDefaults.dracula);
		expect(cleanThemeFile({ theme: 'custom', customPalette: { ...customPaletteDefaults.dark, bgCard: 'nope' } }).customPalette).toBeUndefined();
	});
	it('cuts oversized CSS and background URLs', () => {
		const t = cleanThemeFile({ customCss: 'x'.repeat(MAX_CUSTOM_CSS + 10), background: { type: 'image', value: 'h'.repeat(5000) } });
		expect(t.customCss).toHaveLength(MAX_CUSTOM_CSS);
		expect(t.background!.value).toHaveLength(2000);
	});
	it('throws on anything that is not a theme', () => {
		expect(() => cleanThemeFile(null)).toThrow('Not a theme file');
		expect(() => cleanThemeFile('theme')).toThrow('Not a theme file');
		expect(() => cleanThemeFile({ foo: 1 })).toThrow('No theme settings');
	});
});
