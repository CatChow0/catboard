import { describe, expect, it } from 'vitest';
import { createLimiter } from './rate-limit';

const MIN = 60_000;

function setup() {
	let t = 0;
	const limiter = createLimiter({ max: 5, windowMs: 15 * MIN, blockMs: 30_000, maxBlockMs: 15 * MIN, now: () => t });
	return { limiter, advance: (ms: number) => (t += ms) };
}

describe('login limiter', () => {
	it('allows the first failures, blocks from the fifth', () => {
		const { limiter } = setup();
		for (let i = 0; i < 4; i++) {
			limiter.fail('bob');
			expect(limiter.check('bob').blocked).toBe(false);
		}
		limiter.fail('bob');
		expect(limiter.check('bob')).toEqual({ blocked: true, retryAfter: 30 });
	});

	it('lets the user try again after the wait, and doubles it on each new failure', () => {
		const { limiter, advance } = setup();
		for (let i = 0; i < 5; i++) limiter.fail('bob');
		advance(30_000);
		expect(limiter.check('bob').blocked).toBe(false);
		limiter.fail('bob');
		expect(limiter.check('bob').retryAfter).toBe(60);
		advance(60_000);
		limiter.fail('bob');
		expect(limiter.check('bob').retryAfter).toBe(120);
	});

	it('never blocks for more than the maximum', () => {
		const { limiter, advance } = setup();
		for (let i = 0; i < 40; i++) {
			limiter.fail('bob');
			advance(1000);
		}
		expect(limiter.check('bob').retryAfter).toBeLessThanOrEqual(15 * 60);
	});

	it('a success clears the failures', () => {
		const { limiter } = setup();
		for (let i = 0; i < 4; i++) limiter.fail('bob');
		limiter.reset('bob');
		limiter.fail('bob');
		expect(limiter.check('bob').blocked).toBe(false);
	});

	it('failures older than the window are forgotten', () => {
		const { limiter, advance } = setup();
		for (let i = 0; i < 4; i++) limiter.fail('bob');
		advance(16 * MIN);
		limiter.fail('bob');
		expect(limiter.check('bob').blocked).toBe(false);
	});

	it('keys are independent', () => {
		const { limiter } = setup();
		for (let i = 0; i < 5; i++) limiter.fail('bob');
		expect(limiter.check('alice').blocked).toBe(false);
	});

	it('sweep drops entries that are no longer useful', () => {
		const { limiter, advance } = setup();
		limiter.fail('bob');
		for (let i = 0; i < 5; i++) limiter.fail('eve');
		expect(limiter.size()).toBe(2);
		advance(16 * MIN);
		limiter.sweep();
		expect(limiter.size()).toBe(0);
	});
});
