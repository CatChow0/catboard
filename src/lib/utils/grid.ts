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

/** What a group needs to draw an ongoing drag (built by Dashboard). */
export interface GroupDragView {
	/** Children being dragged out of this group: drawn as ghosts following the pointer. */
	ghostIds: Set<string>;
	ghostTransform: string;
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

/** Columns always bound a container; rows only bound groups (the root grows). */
export interface Bounds {
	cols: number;
	rows?: number;
}

function fits(r: Rect, b: Bounds): boolean {
	return r.col >= 0 && r.row >= 0 && r.col + r.colSpan <= b.cols && (b.rows == null || r.row + r.rowSpan <= b.rows);
}

/**
 * Places `moved` (one item, or a block of selected items) and pushes every
 * tile it overlaps straight down, just below whatever hits it; pushes cascade.
 * Tiles are settled in reading order, so untouched tiles never move.
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
	const rest = items.filter((i) => !moved.has(i.id)).sort((a, b) => a.row - b.row || a.col - b.col);
	for (const item of rest) {
		const r: Rect = { col: item.col, row: item.row, colSpan: item.colSpan, rowSpan: item.rowSpan };
		// Each step jumps below the lowest blocker, so this terminates.
		for (let hit = settled.find((s) => cellsOverlap(r, s)); hit; hit = settled.find((s) => cellsOverlap(r, s))) {
			r.row = hit.row + hit.rowSpan;
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