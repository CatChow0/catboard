import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { en } from './en';
import { fr } from './fr';
import { errorText, isKey, loadLocale, locale, lookup, resolveLocale, translate, type Entry } from '.';
import { categoryLabel, localIntegration, localWidget, printLabel } from './catalog';
import { INTEGRATIONS, INTEGRATION_CATEGORIES } from '$lib/integrations/registry';
import { WIDGETS, WIDGET_CATEGORIES } from '$lib/widgets/catalog';

beforeAll(() => loadLocale('fr'));

const params = (e: Entry) => {
	const texts = typeof e === 'string' ? [e] : [e.one, e.other, ...(e.zero ? [e.zero] : [])];
	return [...new Set(texts.flatMap((t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();
};

describe('dictionaries', () => {
	const keys = Object.keys(en) as (keyof typeof en)[];

	it('French has every English key and no other', () => {
		expect(Object.keys(fr).sort()).toEqual([...keys].sort());
	});

	it('French uses the same {params} as English', () => {
		const diff = keys.filter((k) => params(en[k]).join() !== params(fr[k]).join()).map((k) => `${k}: ${params(en[k])} / ${params(fr[k])}`);
		expect(diff).toEqual([]);
	});

	it('plural entries stay plural in both languages', () => {
		const diff = keys.filter((k) => typeof en[k] !== typeof fr[k]);
		expect(diff).toEqual([]);
	});

	it('no empty text', () => {
		const empty = keys.filter((k) => params(en[k]) && [en[k], fr[k]].some((e) => (typeof e === 'string' ? e : e.other).trim() === ''));
		expect(empty).toEqual([]);
	});
});

describe('translate', () => {
	it('fills parameters', () => {
		expect(translate('en', 'admin.confirmDelete', { name: 'bob' })).toBe('Delete user "bob"?');
		expect(translate('fr', 'admin.confirmDelete', { name: 'bob' })).toBe("Supprimer l'utilisateur « bob » ?");
	});

	it('picks the plural form of each language', () => {
		expect(translate('en', 'backups.files', { count: 1 })).toBe('1 file');
		expect(translate('en', 'backups.files', { count: 0 })).toBe('0 files');
		expect(translate('fr', 'backups.files', { count: 0 })).toBe('0 fichier');
		expect(translate('fr', 'backups.files', { count: 2 })).toBe('2 fichiers');
	});

	it('leaves unknown placeholders', () => {
		expect(translate('en', 'admin.confirmDelete')).toBe('Delete user "{name}"?');
	});
});

describe('resolveLocale', () => {
	it('follows the setting, else the browser', () => {
		expect(resolveLocale('fr', 'en-US')).toBe('fr');
		expect(resolveLocale('en', 'fr-FR')).toBe('en');
		expect(resolveLocale('auto', 'fr-CA')).toBe('fr');
		expect(resolveLocale(undefined, 'de-DE')).toBe('en');
	});
});

describe('errorText', () => {
	beforeEach(() => locale.set('en'));

	it('translates the code of an API error', () => {
		locale.set('fr');
		expect(errorText({ error: 'Cannot reach Spoolman', code: 'errors.cannotReach', params: { name: 'Spoolman' } })).toBe('Impossible de joindre Spoolman');
	});

	it('falls back to the English text, then the status', () => {
		expect(errorText({ error: 'Something odd', code: 'not.a.key' })).toBe('Something odd');
		expect(errorText({}, 503)).toBe('HTTP error 503');
	});
});

describe('catalog', () => {
	it('lookup keeps the fallback for unknown keys', () => {
		expect(isKey('nope.nope')).toBe(false);
		expect(lookup('fr', 'nope.nope', 'Proxmox')).toBe('Proxmox');
	});

	it('every category has a French label', () => {
		for (const c of [...INTEGRATION_CATEGORIES, ...WIDGET_CATEGORIES]) expect(categoryLabel('en', c)).toBe(c);
		expect(categoryLabel('fr', '3D printing')).toBe('Impression 3D');
	});

	it('English copies are unchanged', () => {
		for (const d of INTEGRATIONS) expect(localIntegration('en', d)).toEqual(d);
		for (const w of WIDGETS) expect(localWidget('en', w)).toEqual(w);
	});

	it('every integration text and field label is translated', () => {
		const missing: string[] = [];
		for (const d of INTEGRATIONS) {
			const f = localIntegration('fr', d);
			if (f.description === d.description) missing.push(`${d.key}.desc`);
			if (d.help && f.help === d.help) missing.push(`${d.key}.help`);
			f.fields.forEach((field, i) => {
				const label = d.fields[i].label;
				if (field.label === label && !['URL'].includes(label)) missing.push(`${d.key}.${field.id}`);
				if (d.fields[i].hint && field.hint === d.fields[i].hint) missing.push(`${d.key}.${field.id}.hint`);
			});
		}
		expect(missing).toEqual([]);
	});

	it('every widget description is translated', () => {
		expect(WIDGETS.filter((w) => localWidget('fr', w).description === w.description).map((w) => w.id)).toEqual([]);
	});

	it('printer labels', () => {
		expect(printLabel('fr', 'Heating bed')).toBe('Chauffe du plateau');
		expect(printLabel('fr', 'Something new')).toBe('Something new');
	});
});
