import { describe, expect, it } from 'vitest';
import { swipeDirection } from './swipe';

const at = { x: 200, y: 300, t: 0 };

describe('swipeDirection', () => {
	it('finger to the left brings the next dashboard, to the right the previous one', () => {
		expect(swipeDirection(at, { x: 100, y: 310, t: 200 })).toBe('next');
		expect(swipeDirection(at, { x: 300, y: 290, t: 200 })).toBe('prev');
	});

	it('ignores short, slow or mostly vertical moves', () => {
		expect(swipeDirection(at, { x: 150, y: 300, t: 200 })).toBeNull();
		expect(swipeDirection(at, { x: 50, y: 300, t: 900 })).toBeNull();
		expect(swipeDirection(at, { x: 120, y: 400, t: 200 })).toBeNull();
	});
});
