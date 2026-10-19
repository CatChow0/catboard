// Failed-login limiter, in memory: after `max` failures within `windowMs` a
// key (a username or a client address) is blocked for `blockMs`, doubled at
// each further failure up to `maxBlockMs`. A successful login resets the key.

export interface LimiterOptions {
	max: number;
	windowMs: number;
	blockMs: number;
	maxBlockMs: number;
	now?: () => number;
}

type Entry = { failures: number[]; blockedUntil: number; strikes: number };

export function createLimiter({ max, windowMs, blockMs, maxBlockMs, now = Date.now }: LimiterOptions) {
	const entries = new Map<string, Entry>();

	return {
		/** Whether the key may try now, and how many seconds to wait when it may not. */
		check(key: string): { blocked: boolean; retryAfter: number } {
			const e = entries.get(key);
			const wait = e ? e.blockedUntil - now() : 0;
			return wait > 0 ? { blocked: true, retryAfter: Math.ceil(wait / 1000) } : { blocked: false, retryAfter: 0 };
		},

		fail(key: string) {
			const t = now();
			const e = entries.get(key) ?? { failures: [], blockedUntil: 0, strikes: 0 };
			e.failures = [...e.failures.filter((f) => t - f < windowMs), t];
			if (e.failures.length >= max) {
				e.blockedUntil = t + Math.min(maxBlockMs, blockMs * 2 ** e.strikes);
				e.strikes++;
			}
			entries.set(key, e);
		},

		reset(key: string) {
			entries.delete(key);
		},

		/** Drops keys with no recent failure and no running block. */
		sweep() {
			const t = now();
			for (const [key, e] of entries) {
				if (e.blockedUntil <= t && e.failures.every((f) => t - f >= windowMs)) entries.delete(key);
			}
		},

		size: () => entries.size
	};
}

// The limiter used by POST /api/auth/login. LOGIN_RATE_LIMIT_MS shortens the
// first block (the API tests set it); production uses 30 s.
export const loginLimiter = createLimiter({
	max: 5,
	windowMs: 15 * 60_000,
	blockMs: Number(process.env.LOGIN_RATE_LIMIT_MS) || 30_000,
	maxBlockMs: 15 * 60_000
});
// Per client address, with a higher threshold: behind a reverse proxy without
// ADDRESS_HEADER every request shares the proxy's address.
export const addressLimiter = createLimiter({
	max: 20,
	windowMs: 15 * 60_000,
	blockMs: Number(process.env.LOGIN_RATE_LIMIT_MS) || 30_000,
	maxBlockMs: 15 * 60_000
});
setInterval(() => {
	loginLimiter.sweep();
	addressLimiter.sweep();
}, 10 * 60_000).unref?.();
