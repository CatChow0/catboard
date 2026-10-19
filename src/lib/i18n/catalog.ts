// Catalog data (integrations registry, widget catalog) stays in English; these
// return translated copies, looked up by id: `integ.<key>.desc`,
// `integ.<key>.<field>.label`, `field.<label slug>`, `widgetDef.<id>.name`, `category.<id>`.
// A missing key keeps the English text, so proper nouns need no entry.
import { lookup, type Locale } from '.';
import type { IntegrationDef } from '$lib/integrations/registry';
import type { WidgetDef } from '$lib/widgets/catalog';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function categoryLabel(loc: Locale, category: string): string {
	return lookup(loc, `category.${slug(category)}`, category);
}

export function localIntegration(loc: Locale, def: IntegrationDef): IntegrationDef {
	const k = `integ.${def.key}`;
	return {
		...def,
		name: lookup(loc, `${k}.name`, def.name),
		description: lookup(loc, `${k}.desc`, def.description),
		help: def.help && lookup(loc, `${k}.help`, def.help),
		itemName: def.itemName && lookup(loc, `${k}.item`, def.itemName),
		fields: def.fields.map((f) => ({
			...f,
			label: lookup(loc, `${k}.${f.id}.label`, lookup(loc, `field.${slug(f.label)}`, f.label)),
			hint: f.hint && lookup(loc, `${k}.${f.id}.hint`, f.hint),
			placeholder: f.placeholder && lookup(loc, `${k}.${f.id}.placeholder`, f.placeholder)
		}))
	};
}

export function localWidget(loc: Locale, def: WidgetDef): WidgetDef {
	const k = `widgetDef.${def.id}`;
	return { ...def, name: lookup(loc, `${k}.name`, def.name), description: lookup(loc, `${k}.desc`, def.description) };
}

/** Printer state and speed labels sent by the server (English), e.g. "Heating bed". */
export function printLabel(loc: Locale, label: string): string {
	return lookup(loc, `print.${slug(label)}`, label);
}
