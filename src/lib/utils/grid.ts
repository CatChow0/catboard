import type { DashboardItem } from '$lib/stores/dashboard';

interface Rect {
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
	maxCols: number
): { col: number; row: number } {
	const maxRow = items.reduce((max, item) => Math.max(max, item.row + item.rowSpan), 0) + rowSpan;
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
	maxCols: number
): { col: number; row: number } {
	return {
		col: Math.max(0, Math.min(col, maxCols - colSpan)),
		row: Math.max(0, row)
	};
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