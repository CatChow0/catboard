import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJson, renameWithRetry, withLock, writeFileAtomic, writeJsonAtomic } from './fs-safe';

let dir = '';
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'catboard-fs-'));
});
afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('writeJsonAtomic', () => {
	it('writes pretty JSON and leaves no temporary file behind', async () => {
		const file = join(dir, 'a.json');
		await writeJsonAtomic(file, { a: 1 });
		expect(await readFile(file, 'utf-8')).toBe('{\n  "a": 1\n}');
		expect(await readdir(dir)).toEqual(['a.json']);
	});

	it('replaces an existing file', async () => {
		const file = join(dir, 'a.json');
		await writeFile(file, '{"old":true}');
		await writeJsonAtomic(file, { new: true });
		expect(JSON.parse(await readFile(file, 'utf-8'))).toEqual({ new: true });
	});

	it('concurrent writes never interleave: the last one wins, the file stays valid', async () => {
		const file = join(dir, 'a.json');
		const big = (n: number) => ({ n, data: 'x'.repeat(200_000) });
		await Promise.all(Array.from({ length: 20 }, (_, n) => writeJsonAtomic(file, big(n))));
		const saved = JSON.parse(await readFile(file, 'utf-8'));
		expect(saved.n).toBe(19);
		expect(await readdir(dir)).toEqual(['a.json']);
	});

	it('writeFileAtomic writes raw bytes', async () => {
		const file = join(dir, 'b.bin');
		await writeFileAtomic(file, Buffer.from([1, 2, 3]));
		expect([...(await readFile(file))]).toEqual([1, 2, 3]);
	});
});

describe('readJson', () => {
	it('reads JSON, or gives the fallback when the file is missing', async () => {
		await writeFile(join(dir, 'ok.json'), '{"x":2}');
		expect(await readJson(join(dir, 'ok.json'), {})).toEqual({ x: 2 });
		expect(await readJson(join(dir, 'missing.json'), { d: 1 })).toEqual({ d: 1 });
	});

	it('moves a corrupt file aside and returns the fallback', async () => {
		const file = join(dir, 'bad.json');
		await writeFile(file, '{"half": ');
		expect(await readJson(file, { d: 1 })).toEqual({ d: 1 });
		const names = await readdir(dir);
		expect(names.some((n) => n.startsWith('bad.json.corrupt-'))).toBe(true);
		expect(names).not.toContain('bad.json');
	});

	it('uses the recovery function before the fallback', async () => {
		const file = join(dir, 'bad.json');
		await writeFile(file, 'not json');
		expect(await readJson<object>(file, { d: 1 }, async () => ({ recovered: true }))).toEqual({ recovered: true });
	});
});

describe('withLock', () => {
	it('runs read-modify-write sections on the same key one after another', async () => {
		let value = 0;
		const bump = () =>
			withLock('counter', async () => {
				const read = value;
				await new Promise((r) => setTimeout(r, 2));
				value = read + 1;
			});
		await Promise.all(Array.from({ length: 25 }, bump));
		expect(value).toBe(25);
	});

	it('a failing section does not block the next one', async () => {
		await expect(withLock('k', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
		expect(await withLock('k', async () => 'ok')).toBe('ok');
	});

	it('different keys do not wait for each other', async () => {
		const order: string[] = [];
		await Promise.all([
			withLock('slow', async () => { await new Promise((r) => setTimeout(r, 30)); order.push('slow'); }),
			withLock('fast', async () => { order.push('fast'); })
		]);
		expect(order).toEqual(['fast', 'slow']);
	});
});

describe('renameWithRetry', () => {
	const fail = (code: string, times: number) => {
		let calls = 0;
		const rn = async () => {
			if (++calls <= times) throw Object.assign(new Error(code), { code });
		};
		return { rn: rn as never, calls: () => calls };
	};

	it('tries again while Windows holds the file (EPERM, EACCES, EBUSY)', async () => {
		for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
			const f = fail(code, 3);
			await renameWithRetry('a', 'b', f.rn);
			expect(f.calls()).toBe(4);
		}
	});

	it('gives up after a while, and at once on other errors', async () => {
		const busy = fail('EPERM', 100);
		await expect(renameWithRetry('a', 'b', busy.rn)).rejects.toThrow('EPERM');
		expect(busy.calls()).toBe(8);
		const missing = fail('ENOENT', 1);
		await expect(renameWithRetry('a', 'b', missing.rn)).rejects.toThrow('ENOENT');
		expect(missing.calls()).toBe(1);
	});
});
