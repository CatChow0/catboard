import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { getLayout, setLayout, dashboardList, dashboardLayouts, setDashboardLayouts, normalizeDashboards, MAIN_DASHBOARD } from '$lib/server/config';
import { findNextAvailablePosition } from '$lib/utils/grid';
import type { DashboardItem, DashboardMeta, Layout, PerBreakpointLayout } from '$lib/types';
import { requireEditor } from '$lib/server/auth';

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);

/** Names stay unique (they are used in the URL hash): "Media", "Media 2"... */
function uniqueName(list: DashboardMeta[], wanted: string, exceptId?: string): string {
	const taken = new Set(list.filter((d) => d.id !== exceptId).map((d) => d.name.toLowerCase()));
	let name = wanted;
	for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${wanted} ${n}`;
	return name;
}

/** New dashboard: empty grids and navbars (normalizeDashboards then adds the mandatory title). */
function blankFrom(layouts: Record<string, PerBreakpointLayout>): Record<string, PerBreakpointLayout> {
	const out: Record<string, PerBreakpointLayout> = {};
	for (const [bp, l] of Object.entries(layouts)) out[bp] = { items: [], navbar: { columns: l.navbar?.columns || 12, items: [] } };
	return out;
}

/** Remove the items with these ids (at the root or inside groups); returns them. */
function extract(items: DashboardItem[], ids: Set<string>, out: DashboardItem[]): DashboardItem[] {
	const kept: DashboardItem[] = [];
	for (const item of items) {
		if (ids.has(item.id)) out.push(item);
		else if ('children' in item && Array.isArray(item.children)) kept.push({ ...item, children: extract(item.children, ids, out) } as DashboardItem);
		else kept.push(item);
	}
	return kept;
}

/** Find the items with these ids (root or group children) without removing them. */
function collect(items: DashboardItem[], ids: Set<string>, out: DashboardItem[]) {
	for (const item of items) {
		if (ids.has(item.id)) out.push(item);
		else if ('children' in item && Array.isArray(item.children)) collect(item.children, ids, out);
	}
}

/** Deep copy with fresh ids (group children too); services keep their serviceId. */
function cloneWithNewIds(item: DashboardItem): DashboardItem {
	const copy = structuredClone(item) as DashboardItem;
	const renew = (it: DashboardItem) => {
		it.id = randomUUID();
		if ('children' in it && Array.isArray(it.children)) it.children.forEach(renew);
	};
	renew(copy);
	return copy;
}

const bounded = (v: unknown, min: number, max: number): number | undefined => {
	const n = Number(v);
	return v === null || v === undefined || v === '' || !Number.isFinite(n) ? undefined : Math.round(Math.min(max, Math.max(min, n)));
};

/** POST {action, ...} — manage dashboards, copy / move tiles between them, and per-breakpoint layout settings. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = await requireEditor(locals);
	if (denied) return denied;
	const body = await request.json().catch(() => ({}));
	const data: Layout = await getLayout();
	const list = [...dashboardList(data)];
	const index = (id: string) => list.findIndex((d) => d.id === id);
	let result: Record<string, unknown> = {};

	switch (body?.action) {
		case 'create': {
			const id = randomUUID().slice(0, 8);
			const source = typeof body.from === 'string' && index(body.from) >= 0 ? body.from : list[0].id;
			const name = uniqueName(list, clean(body.name) || `Dashboard ${list.length + 1}`);
			list.push({ id, name });
			setDashboardLayouts(data, id, blankFrom(dashboardLayouts(data, source)));
			result = { id, name };
			break;
		}
		case 'rename': {
			const i = index(body.id);
			const name = clean(body.name);
			if (i < 0) return json({ error: 'Unknown dashboard' }, { status: 404 });
			if (!name) return json({ error: 'Enter a name' }, { status: 400 });
			list[i] = { ...list[i], name: uniqueName(list, name, body.id) };
			result = { name: list[i].name };
			break;
		}
		case 'move': {
			const i = index(body.id);
			const j = i + (body.dir === -1 ? -1 : 1);
			if (i < 0) return json({ error: 'Unknown dashboard' }, { status: 404 });
			if (j < 0 || j >= list.length) return json({ ok: true, dashboards: list });
			[list[i], list[j]] = [list[j], list[i]];
			break;
		}
		case 'delete': {
			const i = index(body.id);
			if (i < 0) return json({ error: 'Unknown dashboard' }, { status: 404 });
			if (list.length <= 1) return json({ error: 'The last dashboard cannot be deleted' }, { status: 400 });
			if (body.id === MAIN_DASHBOARD) {
				// "main" owns `layouts`: the next dashboard takes its place and its id.
				const heir = list[i + 1] ?? list[i - 1];
				data.layouts = dashboardLayouts(data, heir.id);
				delete data.pages?.[heir.id];
				list.splice(i, 1);
				list[list.findIndex((d) => d.id === heir.id)] = { id: MAIN_DASHBOARD, name: heir.name };
				result = { renamedTo: MAIN_DASHBOARD, from: heir.id };
			} else {
				delete data.pages?.[body.id];
				list.splice(i, 1);
			}
			break;
		}
		case 'transferItems': {
			// Copy or move tiles to any dashboard x breakpoint (possibly the same dashboard).
			const from = String(body.from || ''), to = String(body.to || '');
			const fromBp = String(body.fromBreakpoint || ''), toBp = String(body.toBreakpoint || fromBp);
			const copy = body.copy === true;
			const ids = new Set<string>(Array.isArray(body.itemIds) ? body.itemIds.map(String) : []);
			if (index(from) < 0 || index(to) < 0) return json({ error: 'Unknown dashboard' }, { status: 404 });
			if (!copy && from === to && fromBp === toBp) return json({ error: 'Already there' }, { status: 400 });
			const src = dashboardLayouts(data, from)[fromBp];
			const dst = dashboardLayouts(data, to)[toBp];
			if (!src || !dst || ids.size === 0) return json({ error: 'Nothing to transfer' }, { status: 400 });
			let picked: DashboardItem[] = [];
			if (copy) collect(src.items, ids, picked);
			else src.items = extract(src.items, ids, picked);
			if (copy) picked = picked.map(cloneWithNewIds);
			const cols = Math.min(48, Math.max(1, data.grid.breakpoints.find((b) => b.id === toBp)?.columns || Number(body.columns) || 12));
			for (const it of picked) {
				const colSpan = Math.min(it.colSpan, cols);
				const p = findNextAvailablePosition(dst.items, colSpan, it.rowSpan, cols);
				dst.items.push({ ...it, col: p.col, row: p.row, colSpan } as DashboardItem);
			}
			result = { count: picked.length, copy };
			break;
		}
		case 'layoutSettings': {
			// Grid and navbar settings of one dashboard, at one breakpoint or all of them.
			const i = index(body.id);
			if (i < 0) return json({ error: 'Unknown dashboard' }, { status: 404 });
			const layouts = dashboardLayouts(data, body.id);
			const targets = body.allBreakpoints ? Object.keys(layouts) : [String(body.breakpoint || '')];
			if (!targets.every((bp) => layouts[bp])) return json({ error: 'Unknown breakpoint' }, { status: 400 });
			const g = body.grid || {}, n = body.navbar || {};
			for (const bp of targets) {
				const l = layouts[bp];
				const grid = { cellSize: bounded(g.cellSize, 40, 300), gap: bounded(g.gap, 0, 48) };
				l.grid = grid.cellSize === undefined && grid.gap === undefined ? undefined : grid;
				if (!l.grid) delete l.grid;
				l.navbar.columns = bounded(n.columns, 4, 48) ?? l.navbar.columns ?? 12;
				l.navbar.rowHeight = bounded(n.rowHeight, 28, 120);
				l.navbar.marginTop = bounded(n.marginTop, 0, 48);
				l.navbar.marginBottom = bounded(n.marginBottom, 0, 48);
				for (const k of ['rowHeight', 'marginTop', 'marginBottom'] as const) if (l.navbar[k] === undefined) delete l.navbar[k];
			}
			result = { breakpoints: targets };
			break;
		}
		default:
			return json({ error: 'Unknown action' }, { status: 400 });
	}

	data.dashboards = list;
	normalizeDashboards(data);
	await setLayout(data);
	return json({ ok: true, ...result, dashboards: data.dashboards });
};
