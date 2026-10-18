import type { RequestHandler } from './$types';
import { getCpuStats, getRamStats, getDiskStats } from '$lib/server/system-stats';
import { getLayout, allBreakpointLayouts } from '$lib/server/config';
import type { NavbarDiskItem, NavbarCpuItem, SystemStats } from '$lib/types';

// One poller shared by every open stream (tabs, devices): it runs every 3 s
// while at least one stream listens, and stops with the last one.
const POLL_MS = 3000;

type Listener = (stats: SystemStats) => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | undefined;
let last: SystemStats | undefined;
let busy = false;

/** Disks and CPU sensor the navbar widgets ask for, re-read each poll so changes apply live. */
async function wanted() {
	const layout = await getLayout();
	const items = allBreakpointLayouts(layout).flatMap((l) => l.navbar?.items || []);
	const diskPaths = items.filter((item): item is NavbarDiskItem => item.type === 'navbar-disk').flatMap((item) => item.config?.disks || []);
	const cpuSensor = items.find((item): item is NavbarCpuItem => item.type === 'navbar-cpu')?.config?.tempSensor;
	return { diskPaths, cpuSensor };
}

async function poll() {
	if (busy) return;
	busy = true;
	try {
		const { diskPaths, cpuSensor } = await wanted();
		const [cpu, ram, disks] = await Promise.all([getCpuStats(cpuSensor), getRamStats(), getDiskStats(diskPaths.length > 0 ? diskPaths : undefined)]);
		last = { cpu, ram, disks };
		for (const l of listeners) l(last);
	} catch {
		// skip failed poll
	} finally {
		busy = false;
	}
}

function subscribe(listener: Listener): () => void {
	listeners.add(listener);
	if (last) listener(last);
	if (!timer) {
		poll();
		timer = setInterval(poll, POLL_MS);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			clearInterval(timer);
			timer = undefined;
			last = undefined;
		}
	};
}

export const GET: RequestHandler = async ({ request }) => {
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			let unsubscribe = () => {};
			unsubscribe = subscribe((stats) => {
				try {
					controller.enqueue(encoder.encode(`event: system-stats\ndata: ${JSON.stringify(stats)}\n\n`));
				} catch {
					unsubscribe();
				}
			});
			request.signal.addEventListener('abort', () => {
				unsubscribe();
				try { controller.close(); } catch {}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
