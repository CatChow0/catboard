import { describe, expect, it } from 'vitest';
import { baseUrl, client } from './helpers';

/** Reads `count` SSE events from a stream, then closes it. */
async function readEvents(cookie: string, count: number, ms = 15_000) {
	const ac = new AbortController();
	const res = await fetch(baseUrl() + '/api/system-stats', { headers: { cookie }, signal: ac.signal });
	expect(res.headers.get('content-type')).toBe('text/event-stream');
	const reader = res.body!.getReader();
	const decoder = new TextDecoder();
	let text = '';
	const end = Date.now() + ms;
	while ((text.match(/event: system-stats/g) ?? []).length < count && Date.now() < end) {
		const { value, done } = await reader.read();
		if (done) break;
		text += decoder.decode(value);
	}
	ac.abort();
	return text
		.split('\n\n')
		.filter((e) => e.startsWith('event: system-stats'))
		.map((e) => JSON.parse(e.split('\ndata: ')[1]));
}

describe('system stats stream', () => {
	it('sends CPU, RAM and disk readings', async () => {
		const user = await client('user');
		const [first] = await readEvents(user.cookie, 1);
		expect(first.cpu.cores).toBeGreaterThan(0);
		expect(first.ram.total).toBeGreaterThan(0);
		expect(typeof first.disks).toBe('object');
	});

	it('two streams get the same readings (one shared poller)', async () => {
		const user = await client('user');
		const [a, b] = await Promise.all([readEvents(user.cookie, 2), readEvents(user.cookie, 2)]);
		expect(a.length).toBe(2);
		expect(b.length).toBe(2);
		expect(b.some((x) => a.some((y) => JSON.stringify(x) === JSON.stringify(y)))).toBe(true);
	});
});
