import type { DashboardItem } from '$lib/stores/dashboard';

export interface Rect {
	col: number;
	row: number;
	colSpan: number;
	rowSpan: number;
}

export function cellsOverlap(a: Rect, b: Rect): boolean {
	return (
		a.col < b.col + b.colSpan &&
		a.col + a.colSpan > b.col &&
		a.row < b.row + b.rowSpan &&
		a.row + a.rowSpan > b.row
	);
}

export function hasCollision(
	items: DashboardItem[],
	excludeId: string,
	col: number,
	row: number,
	colSpan: number,
	rowSpan: number
): boolean {
	const candidate: Rect = { col, row, colSpan, rowSpan };
	return items.some((item) => {
		if (item.id === excludeId) return false;
		return cellsOverlap(candidate, item);
	});
}

export function hasCollisionExcluding(
	items: DashboardItem[],
	excludeIds: Set<string>,
	positions: Map<string, Rect>
): boolean {
	for (const [id, rect] of positions) {
		for (const item of items) {
			if (excludeIds.has(item.id) || item.id === id) continue;
			if (cellsOverlap(rect, item)) return true;
		}
	}
	return false;
}

export function maxResize(
	items: DashboardItem[],
	excludeId: string,
	col: number,
	row: number,
	startColSpan: number,
	startRowSpan: number,
	targetColSpan: number,
	targetRowSpan: number
): { colSpan: number; rowSpan: number } {
	let colSpan = startColSpan;
	let rowSpan = startRowSpan;

	// Grow colSpan one step at a time toward the target
	if (targetColSpan > startColSpan) {
		for (let cs = startColSpan + 1; cs <= targetColSpan; cs++) {
			if (hasCollision(items, excludeId, col, row, cs, rowSpan)) break;
			colSpan = cs;
		}
	} else {
		colSpan = targetColSpan;
	}

	// Grow rowSpan one step at a time toward the target
	if (targetRowSpan > startRowSpan) {
		for (let rs = startRowSpan + 1; rs <= targetRowSpan; rs++) {
			if (hasCollision(items, excludeId, col, row, colSpan, rs)) break;
			rowSpan = rs;
		}
	} else {
		rowSpan = targetRowSpan;
	}

	return { colSpan, rowSpan };
}

export function findNextAvailablePosition(
	items: DashboardItem[],
	colSpan: number,
	rowSpan: number,
	maxCols: number,
	maxRows?: number
): { col: number; row: number } {
	let maxRow = items.reduce((max, item) => Math.max(max, item.row + item.rowSpan), 0) + rowSpan;
	// Bounded containers (groups): only look inside the box.
	if (maxRows != null) maxRow = maxRows - rowSpan;
	for (let row = 0; row <= maxRow; row++) {
		for (let col = 0; col <= maxCols - colSpan; col++) {
			if (!hasCollision(items, '', col, row, colSpan, rowSpan)) {
				return { col, row };
			}
		}
	}
	return { col: 0, row: maxRow > 0 ? maxRow : 0 };
}

export function clampPosition(
	col: number,
	row: number,
	colSpan: number,
	rowSpan: number,
	maxCols: number,
	maxRows?: number
): { col: number; row: number } {
	return {
		col: Math.max(0, Math.min(col, maxCols - colSpan)),
		row: Math.max(0, maxRows != null ? Math.min(row, maxRows - rowSpan) : row)
	};
}

// --- Group geometry ------------------------------------------------------------
// A group shows colSpan x rowSpan cells. With `config.scroll` its content may
// extend past that along one axis (cells keep their visible size) and scrolls.

type GroupLike = { colSpan: number; rowSpan: number; children: Rect[]; config?: { scroll?: 'vertical' | 'horizontal' } };

/** Tracks the group's inner grid must render to hold its children. */
export function groupTracks(g: GroupLike): { cols: number; rows: number } {
	const scroll = g.config?.scroll;
	if (scroll === 'vertical') return { cols: g.colSpan, rows: Math.max(g.rowSpan, ...g.children.map((c) => c.row + c.rowSpan)) };
	if (scroll === 'horizontal') return { cols: Math.max(g.colSpan, ...g.children.map((c) => c.col + c.colSpan)), rows: g.rowSpan };
	return { cols: g.colSpan, rows: g.rowSpan };
}

/**
 * Drag bounds inside a group. Fixed groups are a box; scrolling groups are
 * unbounded along their axis (like the root grid) so a full group can still
 * take tiles: vertical ones push tiles down, horizontal ones push them right.
 */
export function groupBounds(g: GroupLike): Bounds {
	const t = groupTracks(g);
	if (g.config?.scroll === 'vertical') return { cols: t.cols };
	if (g.config?.scroll === 'horizontal') return { cols: Infinity, rows: t.rows, push: 'right' };
	return { cols: t.cols, rows: t.rows };
}

/** First free spot for a tile appended to a group, or null if a fixed group is full. */
export function groupNextPosition(g: GroupLike, kids: Rect[], colSpan: number, rowSpan: number): { col: number; row: number } | null {
	const free = (col: number, row: number) => !kids.some((k) => cellsOverlap(k, { col, row, colSpan, rowSpan }));
	const scroll = g.config?.scroll;
	if (scroll === 'horizontal') {
		// Fill column by column; there is always room further right.
		for (let col = 0; ; col++) for (let row = 0; row + rowSpan <= g.rowSpan; row++) if (free(col, row)) return { col, row };
	}
	if (colSpan > g.colSpan) return null;
	const maxRow = scroll === 'vertical' ? Math.max(0, ...kids.map((k) => k.row + k.rowSpan)) : g.rowSpan - rowSpan;
	for (let row = 0; row <= maxRow; row++) for (let col = 0; col + colSpan <= g.colSpan; col++) if (free(col, row)) return { col, row };
	return null;
}

/** What a group needs to draw an ongoing drag (built by Dashboard). */
export interface GroupDragView {
	/** Children being dragged from this group (drawn faded; a floating copy follows the pointer). */
	ghostIds: Set<string>;
	/** Previewed positions of this group's children when it is the drop target. */
	preview: Map<string, Rect> | null;
	placeholders: Rect[];
}

// --- Drag engine -------------------------------------------------------------
// Pure layout functions used by the edit-mode drag controller. They never touch
// the DOM and always work from the layout snapshot taken when the drag started,
// so a preview is fully reversible: moving back restores every tile.

export interface Placed extends Rect {
	id: string;
}

/**
 * Columns bound a container (Infinity for horizontal scrolling groups); rows
 * only bound fixed and horizontal groups (the root and vertical groups grow).
 * `push` is where tiles in the way go: down (default) or right.
 */
export interface Bounds {
	cols: number;
	rows?: number;
	push?: 'down' | 'right';
}

function fits(r: Rect, b: Bounds): boolean {
	return r.col >= 0 && r.row >= 0 && r.col + r.colSpan <= b.cols && (b.rows == null || r.row + r.rowSpan <= b.rows);
}

/**
 * Places `moved` (one item, or a block of selected items) and pushes every
 * tile it overlaps straight down (or right, see Bounds.push), just past whatever
 * hits it; pushes cascade. Tiles are settled in reading order, so untouched tiles never move.
 * Returns the full new position map, or null if a tile would leave `bounds`.
 */
export function moveWithPush(items: Placed[], moved: Map<string, Rect>, bounds: Bounds): Map<string, Rect> | null {
	const settled: Rect[] = [];
	const out = new Map<string, Rect>();
	for (const [id, r] of moved) {
		if (!fits(r, bounds)) return null;
		settled.push(r);
		out.set(id, r);
	}
	const right = bounds.push === 'right';
	const rest = items
		.filter((i) => !moved.has(i.id))
		.sort((a, b) => (right ? a.col - b.col || a.row - b.row : a.row - b.row || a.col - b.col));
	for (const item of rest) {
		const r: Rect = { col: item.col, row: item.row, colSpan: item.colSpan, rowSpan: item.rowSpan };
		// Each step jumps past the blocker (below it, or right of it), so this terminates.
		for (let hit = settled.find((s) => cellsOverlap(r, s)); hit; hit = settled.find((s) => cellsOverlap(r, s))) {
			if (right) r.col = hit.col + hit.colSpan;
			else r.row = hit.row + hit.rowSpan;
		}
		if (!fits(r, bounds)) return null;
		settled.push(r);
		out.set(item.id, r);
	}
	return out;
}

/**
 * Swap fallback for bounded groups: if `target` overlaps exactly one tile and
 * that tile fits where the dragged tile came from, the two trade places.
 */
export function swapInto(items: Placed[], id: string, target: Rect, origin: Rect, bounds: Bounds): Map<string, Rect> | null {
	if (!fits(target, bounds)) return null;
	const hits = items.filter((i) => i.id !== id && cellsOverlap(target, i));
	if (hits.length !== 1) return null;
	const other = hits[0];
	const otherAt: Rect = { col: origin.col, row: origin.row, colSpan: other.colSpan, rowSpan: other.rowSpan };
	if (!fits(otherAt, bounds) || cellsOverlap(otherAt, target)) return null;
	const out = new Map<string, Rect>();
	for (const i of items) {
		if (i.id === id) out.set(i.id, target);
		else if (i.id === other.id) out.set(i.id, otherAt);
		else {
			if (cellsOverlap(i, target) || cellsOverlap(i, otherAt)) return null;
			out.set(i.id, { col: i.col, row: i.row, colSpan: i.colSpan, rowSpan: i.rowSpan });
		}
	}
	return out;
}

/** Resizing pushes neighbours the same way moving does. */
export function resizeWithPush(items: Placed[], id: string, colSpan: number, rowSpan: number, bounds: Bounds): Map<string, Rect> | null {
	const item = items.find((i) => i.id === id);
	if (!item) return null;
	return moveWithPush(items, new Map([[id, { col: item.col, row: item.row, colSpan, rowSpan }]]), bounds);
}

/** Pixel geometry of a CSS grid, from its bounding rect. */
export interface GridMetrics {
	left: number;
	top: number;
	colStep: number;
	rowStep: number;
}

/**
 * `pad` is the grid's inner padding (groups pad by the gap). Rows are either a
 * fixed `cellSize` (root, auto rows) or `rows` equal tracks filling the height (groups).
 */
export function gridMetrics(
	rect: { left: number; top: number; width: number; height: number },
	cols: number,
	gap: number,
	opts: { pad?: number; cellSize?: number; rows?: number }
): GridMetrics {
	const pad = opts.pad ?? 0;
	const colStep = (rect.width - 2 * pad - (cols - 1) * gap) / cols + gap;
	const rowStep =
		opts.rows != null ? (rect.height - 2 * pad - (opts.rows - 1) * gap) / opts.rows + gap : (opts.cellSize ?? 80) + gap;
	return { left: rect.left + pad, top: rect.top + pad, colStep, rowStep };
}

/** Nearest cell for a tile whose top-left corner is at (x, y) in page pixels. */
export function cellAt(m: GridMetrics, x: number, y: number): { col: number; row: number } {
	return { col: Math.round((x - m.left) / m.colStep), row: Math.round((y - m.top) / m.rowStep) };
}

export function snapToGrid(
	pixelX: number,
	pixelY: number,
	gridRect: DOMRect,
	columns: number,
	cellSize: number,
	gap: number
): { col: number; row: number } {
	const colWidth = gridRect.width / columns;
	const rowHeight = cellSize + gap;
	return {
		col: Math.max(0, Math.min(Math.floor(pixelX / colWidth), columns - 1)),
		row: Math.max(0, Math.floor(pixelY / rowHeight))
	};
}