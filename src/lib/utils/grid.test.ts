import { describe, expect, it } from 'vitest';
import type { DashboardItem } from '$lib/stores/dashboard';
import {
	cellsOverlap, hasCollision, hasCollisionExcluding, maxResize, findNextAvailablePosition, clampPosition,
	groupTracks, groupBounds, groupNextPosition, moveWithPush, swapInto, resizeWithPush, gridMetrics, cellAt,
	type Placed, type Rect
} from './grid';

const tile = (id: string, col: number, row: number, colSpan = 1, rowSpan = 1) =>
	({ id, type: 'clock', col, row, colSpan, rowSpan }) as DashboardItem;
const placed = (id: string, col: number, row: number, colSpan = 1, rowSpan = 1): Placed => ({ id, col, row, colSpan, rowSpan });
const at = (m: Map<string, Rect> | null, id: string) => {
	const r = m?.get(id);
	return r && { col: r.col, row: r.row };
};

describe('cellsOverlap', () => {
	it('detects shared cells', () => {
		expect(cellsOverlap({ col: 0, row: 0, colSpan: 2, rowSpan: 2 }, { col: 1, row: 1, colSpan: 2, rowSpan: 2 })).toBe(true);
	});
	it('treats touching edges as free', () => {
		expect(cellsOverlap({ col: 0, row: 0, colSpan: 2, rowSpan: 1 }, { col: 2, row: 0, colSpan: 1, rowSpan: 1 })).toBe(false);
		expect(cellsOverlap({ col: 0, row: 0, colSpan: 1, rowSpan: 2 }, { col: 0, row: 2, colSpan: 1, rowSpan: 1 })).toBe(false);
	});
});

describe('collisions', () => {
	const items = [tile('a', 0, 0, 2, 2), tile('b', 3, 0)];
	it('hasCollision ignores the excluded item', () => {
		expect(hasCollision(items, '', 1, 1, 1, 1)).toBe(true);
		expect(hasCollision(items, 'a', 1, 1, 1, 1)).toBe(false);
		expect(hasCollision(items, '', 2, 0, 1, 1)).toBe(false);
	});
	it('hasCollisionExcluding checks a set of new positions', () => {
		const moving = new Map<string, Rect>([['b', { col: 1, row: 0, colSpan: 1, rowSpan: 1 }]]);
		expect(hasCollisionExcluding(items, new Set(['b']), moving)).toBe(true);
		expect(hasCollisionExcluding(items, new Set(['a', 'b']), moving)).toBe(false);
	});
});

describe('maxResize', () => {
	it('grows until the next tile', () => {
		const items = [tile('a', 0, 0), tile('b', 3, 0)];
		expect(maxResize(items, 'a', 0, 0, 1, 1, 6, 1)).toEqual({ colSpan: 3, rowSpan: 1 });
	});
	it('shrinks freely', () => {
		expect(maxResize([tile('a', 0, 0, 4, 4)], 'a', 0, 0, 4, 4, 2, 1)).toEqual({ colSpan: 2, rowSpan: 1 });
	});
});

describe('findNextAvailablePosition', () => {
	it('fills gaps in reading order', () => {
		const items = [tile('a', 0, 0, 2, 1), tile('b', 3, 0)];
		expect(findNextAvailablePosition(items, 1, 1, 4)).toEqual({ col: 2, row: 0 });
		expect(findNextAvailablePosition(items, 2, 1, 4)).toEqual({ col: 0, row: 1 });
	});
	it('starts at the origin of an empty grid', () => {
		expect(findNextAvailablePosition([], 3, 2, 10)).toEqual({ col: 0, row: 0 });
	});
});

describe('clampPosition', () => {
	it('keeps the tile inside the columns (and rows when bounded)', () => {
		expect(clampPosition(9, -2, 3, 1, 10)).toEqual({ col: 7, row: 0 });
		expect(clampPosition(0, 9, 1, 2, 4, 5)).toEqual({ col: 0, row: 3 });
	});
});

describe('group geometry', () => {
	const kids: Rect[] = [{ col: 0, row: 0, colSpan: 2, rowSpan: 1 }, { col: 0, row: 3, colSpan: 1, rowSpan: 2 }];
	it('fixed groups are a box', () => {
		const g = { colSpan: 3, rowSpan: 2, children: kids };
		expect(groupTracks(g)).toEqual({ cols: 3, rows: 2 });
		expect(groupBounds(g)).toEqual({ cols: 3, rows: 2 });
	});
	it('vertical groups grow with their children and have no row bound', () => {
		const g = { colSpan: 3, rowSpan: 2, children: kids, config: { scroll: 'vertical' as const } };
		expect(groupTracks(g)).toEqual({ cols: 3, rows: 5 });
		expect(groupBounds(g)).toEqual({ cols: 3 });
	});
	it('horizontal groups push right without a column bound', () => {
		const g = { colSpan: 2, rowSpan: 2, children: [{ col: 4, row: 0, colSpan: 1, rowSpan: 1 }], config: { scroll: 'horizontal' as const } };
		expect(groupTracks(g)).toEqual({ cols: 5, rows: 2 });
		expect(groupBounds(g)).toEqual({ cols: Infinity, rows: 2, push: 'right' });
	});
	it('groupNextPosition: free spot, or null when a fixed group is full', () => {
		const g = { colSpan: 2, rowSpan: 1, children: [] };
		expect(groupNextPosition(g, [{ col: 0, row: 0, colSpan: 1, rowSpan: 1 }], 1, 1)).toEqual({ col: 1, row: 0 });
		expect(groupNextPosition(g, [{ col: 0, row: 0, colSpan: 2, rowSpan: 1 }], 1, 1)).toBeNull();
		expect(groupNextPosition(g, [], 3, 1)).toBeNull();
	});
	it('groupNextPosition: scrolling groups always find room', () => {
		const full = [{ col: 0, row: 0, colSpan: 2, rowSpan: 1 }];
		expect(groupNextPosition({ colSpan: 2, rowSpan: 1, children: [], config: { scroll: 'vertical' } }, full, 1, 1)).toEqual({ col: 0, row: 1 });
		expect(groupNextPosition({ colSpan: 2, rowSpan: 1, children: [], config: { scroll: 'horizontal' } }, full, 1, 1)).toEqual({ col: 2, row: 0 });
	});
});

describe('moveWithPush', () => {
	const items = [placed('a', 0, 0, 2, 1), placed('b', 0, 1, 2, 1), placed('c', 3, 0)];

	it('pushes overlapped tiles down, cascading, and leaves the others alone', () => {
		const out = moveWithPush(items, new Map([['c', { col: 0, row: 0, colSpan: 1, rowSpan: 1 }]]), { cols: 4 });
		expect(at(out, 'c')).toEqual({ col: 0, row: 0 });
		expect(at(out, 'a')).toEqual({ col: 0, row: 1 });
		expect(at(out, 'b')).toEqual({ col: 0, row: 2 });
	});
	it('pushes right in horizontal groups', () => {
		const out = moveWithPush(items, new Map([['c', { col: 0, row: 0, colSpan: 1, rowSpan: 1 }]]), { cols: Infinity, rows: 2, push: 'right' });
		expect(at(out, 'a')).toEqual({ col: 1, row: 0 });
	});
	it('refuses moves that leave the bounds', () => {
		expect(moveWithPush(items, new Map([['a', { col: 3, row: 0, colSpan: 2, rowSpan: 1 }]]), { cols: 4 })).toBeNull();
		// Pushing b below row 2 would leave a 2-row box.
		expect(moveWithPush(items, new Map([['c', { col: 0, row: 0, colSpan: 1, rowSpan: 1 }]]), { cols: 4, rows: 2 })).toBeNull();
	});
	it('moving back to the start restores every tile', () => {
		const out = moveWithPush(items, new Map([['c', { col: 3, row: 0, colSpan: 1, rowSpan: 1 }]]), { cols: 4 });
		for (const i of items) expect(at(out, i.id)).toEqual({ col: i.col, row: i.row });
	});
});

describe('swapInto', () => {
	const items = [placed('a', 0, 0), placed('b', 1, 0)];
	const bounds = { cols: 2, rows: 1 };
	it('trades places with the one tile under the target', () => {
		const out = swapInto(items, 'a', { col: 1, row: 0, colSpan: 1, rowSpan: 1 }, { col: 0, row: 0, colSpan: 1, rowSpan: 1 }, bounds);
		expect(at(out, 'a')).toEqual({ col: 1, row: 0 });
		expect(at(out, 'b')).toEqual({ col: 0, row: 0 });
	});
	it('gives up over two tiles or out of bounds', () => {
		expect(swapInto(items, 'a', { col: 0, row: 0, colSpan: 2, rowSpan: 1 }, { col: 0, row: 0, colSpan: 1, rowSpan: 1 }, bounds)).toBeNull();
		expect(swapInto(items, 'a', { col: 2, row: 0, colSpan: 1, rowSpan: 1 }, { col: 0, row: 0, colSpan: 1, rowSpan: 1 }, bounds)).toBeNull();
	});
});

describe('resizeWithPush', () => {
	it('pushes the neighbour below when a tile grows', () => {
		const out = resizeWithPush([placed('a', 0, 0), placed('b', 0, 1)], 'a', 1, 2, { cols: 4 });
		expect(at(out, 'b')).toEqual({ col: 0, row: 2 });
	});
	it('returns null for an unknown tile', () => {
		expect(resizeWithPush([], 'x', 1, 1, { cols: 4 })).toBeNull();
	});
});

describe('pixel geometry', () => {
	it('gridMetrics + cellAt map pixels to the nearest cell', () => {
		const m = gridMetrics({ left: 10, top: 20, width: 4 * 100 + 3 * 10, height: 0 }, 4, 10, { cellSize: 80 });
		expect(m).toEqual({ left: 10, top: 20, colStep: 110, rowStep: 90 });
		expect(cellAt(m, 10 + 2 * 110 + 30, 20 + 90 - 20)).toEqual({ col: 2, row: 1 });
	});
	it('group grids divide their height into equal rows inside the padding', () => {
		const m = gridMetrics({ left: 0, top: 0, width: 220, height: 220 }, 2, 10, { pad: 10, rows: 2 });
		// (220 - 2*10 pad - 10 gap) / 2 rows + 10 gap
		expect(m.rowStep).toBe(105);
		expect(m.left).toBe(10);
	});
});
