import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { duration, timeAgo } from './duration';

describe('duration', () => {
	it.each([
		[0, '0s'],
		[59.4, '59s'],
		[125, '2m 05s'],
		[3725, '1h 02m'],
		[90061, '1d 1h'],
		[-5, '0s']
	])('%s s -> %s', (sec, text) => {
		expect(duration(sec)).toBe(text);
	});
});

describe('timeAgo', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	it.each([
		['2026-10-18T11:59:30Z', 'just now'],
		['2026-10-18T11:55:00Z', '5 min ago'],
		['2026-10-18T09:00:00Z', '3 h ago'],
		['2026-10-16T12:00:00Z', '2 d ago']
	])('%s -> %s', (iso, text) => {
		expect(timeAgo(iso)).toBe(text);
	});

	it('falls back to the date after a month, and to nothing for bad input', () => {
		expect(timeAgo('2026-08-01T00:00:00Z')).toBe(new Date('2026-08-01T00:00:00Z').toLocaleDateString());
		expect(timeAgo(null)).toBe('');
		expect(timeAgo('not a date')).toBe('');
	});
});
