// Translations without a dependency. English (en/) is the reference and the
// fallback; fr/ is typed against it, so a missing French text fails
// `npm run check`. French is downloaded only when needed (`setLocale`). In components: `$t('settings.title')`, with parameters
// `$t('add.count', { count: 3 })`. Entries are a string with {param}
// placeholders, or plural forms picked with Intl.PluralRules.
import { derived, get, writable } from 'svelte/store';
import { en } from './en';

export type Locale = 'en' | 'fr';
export const LOCALES: { id: Locale; name: string }[] = [
	{ id: 'en', name: 'English' },
	{ id: 'fr', name: 'Français' }
];

export type Plural = { zero?: string; one: string; other: string };
export type Entry = string | Plural;
export type Key = keyof typeof en;
export type Dict = Record<Key, Entry>;
export type Params = Record<string, string | number>;

// English is always there (fallback, server messages); French is loaded by setLocale.
const dicts: Partial<Record<Locale, Dict>> = { en };

/** Loads a language's texts (once). */
export async function loadLocale(loc: Locale): Promise<void> {
	if (!dicts[loc] && loc === 'fr') dicts.fr = (await import('./fr')).fr;
}

/** 'auto' (or nothing) follows the browser language; anything not French is English. */
export function resolveLocale(pref: string | undefined, browser?: string): Locale {
	if (pref === 'en' || pref === 'fr') return pref;
	const lang = browser ?? (typeof navigator !== 'undefined' ? navigator.language : 'en');
	return lang?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function isKey(key: string): key is Key {
	return key in en;
}

export function translate(loc: Locale, key: Key, params: Params = {}): string {
	let entry: Entry = dicts[loc]?.[key] ?? en[key] ?? key;
	if (typeof entry !== 'string') {
		const n = Number(params.count ?? 0);
		entry = n === 0 && entry.zero !== undefined ? entry.zero : new Intl.PluralRules(loc).select(n) === 'one' ? entry.one : entry.other;
	}
	return entry.replace(/\{(\w+)\}/g, (m, p: string) => (params[p] !== undefined ? String(params[p]) : m));
}

/** Text whose key is built at run time (catalog data): its translation, else `fallback`. */
export function lookup(loc: Locale, key: string, fallback: string, params?: Params): string {
	return isKey(key) ? translate(loc, key, params) : fallback;
}

/** The language on screen (set by the root layout from the user's setting). */
export const locale = writable<Locale>('en');

let wanted: Locale = 'en';
/** Switches the language once its texts are loaded (the last call wins). */
export async function setLocale(loc: Locale): Promise<void> {
	wanted = loc;
	await loadLocale(loc);
	if (wanted === loc) locale.set(loc);
}

/** `$t(key, params)` in components. */
export const t = derived(locale, (loc) => (key: Key, params?: Params) => translate(loc, key, params));

/** `$tx(key, fallback)`: `lookup` in components. */
export const tx = derived(locale, (loc) => (key: string, fallback: string, params?: Params) => lookup(loc, key, fallback, params));

/** For code outside components (stores, helpers): the current language, not reactive. */
export function tr(key: Key, params?: Params): string {
	return translate(get(locale), key, params);
}

/**
 * Text of an API error body: the server sends `{ error, code?, params? }`;
 * `code` is a translation key, `error` its English text (shown when the code
 * is unknown, e.g. an older server).
 */
export function errorText(body: unknown, status?: number): string {
	const b = (body ?? {}) as { error?: string; message?: string; code?: string; params?: Params };
	if (b.code && isKey(b.code)) return tr(b.code, b.params);
	return b.error || b.message || (status ? tr('common.httpError', { status }) : tr('common.failed'));
}

/** Tag for Intl / toLocale* formatting: French, or the browser's own English variant. */
export const intlLocale = (): string | undefined => (get(locale) === 'fr' ? 'fr-FR' : undefined);
