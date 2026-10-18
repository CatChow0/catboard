import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Service } from '$lib/types';
import { checkAll, checkService, statusCache, statusTtl } from './status';

const service = (id: string, enabled = true, method = 'HEAD') => ({ id, name: id, url: `http://svc/${id}`, statusCheck: { enabled, method } }) as Service;

afterEach(() => vi.unstubAllGlobals());

describe('checkService', () => {
	it('online for 2xx, error for other statuses, offline when unreachable', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url: string) => {
			if (url.endsWith('down')) throw new TypeError('fetch failed');
			return new Response(null, { status: url.endsWith('bad') ? 500 : 204 });
		}));
		expect(await checkService('http://x/ok', 'HEAD')).toBe('online');
		expect(await checkService('http://x/bad', 'HEAD')).toBe('error');
		expect(await checkService('http://x/down', 'HEAD')).toBe('offline');
	});
});

describe('checkAll', () => {
	it('probes only services with a check, with their method, a few at a time', async () => {
		let active = 0;
		let peak = 0;
		const calls: string[] = [];
		vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
			calls.push(`${init.method} ${url}`);
			peak = Math.max(peak, ++active);
			await new Promise((r) => setTimeout(r, 5));
			active--;
			return new Response('');
		}));
		const services = [...Array.from({ length: 10 }, (_, i) => service(`s${i}`)), service('off', false), service('get', true, 'GET')];
		const map = await checkAll(services, 3);
		expect(Object.keys(map)).toHaveLength(11);
		expect(map.off).toBeUndefined();
		expect(calls).toContain('GET http://svc/get');
		expect(peak).toBe(3);
	});
});

describe('statusTtl', () => {
	it('clamps the interval to 10 s - 10 min, 30 s by default', () => {
		expect(statusTtl(60000)).toBe(60000);
		expect(statusTtl(1000)).toBe(10000);
		expect(statusTtl(9e9)).toBe(600000);
		expect(statusTtl(undefined)).toBe(30000);
		expect(statusTtl('nonsense')).toBe(30000);
	});
});

describe('statusCache', () => {
	it('joins concurrent loads and keeps the result for the TTL', async () => {
		let t = 0;
		const load = vi.fn(async () => {
			await new Promise((r) => setTimeout(r, 5));
			return { a: 'online' };
		});
		const get = statusCache(load, () => t);
		const [x, y] = await Promise.all([get(1000), get(1000)]);
		expect(x).toEqual({ a: 'online' });
		expect(y).toBe(x);
		expect(load).toHaveBeenCalledTimes(1);
		t = 999;
		await get(1000);
		expect(load).toHaveBeenCalledTimes(1);
		t = 1000;
		await get(1000);
		expect(load).toHaveBeenCalledTimes(2);
	});
	it('tries again after a failed load', async () => {
		const load = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ a: 'online' });
		const get = statusCache(load);
		await expect(get(1000)).rejects.toThrow('boom');
		expect(await get(1000)).toEqual({ a: 'online' });
	});
});
