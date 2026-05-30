import type { RequestHandler } from './$types';
import { getCpuStats, getRamStats, getDiskStats } from '$lib/server/system-stats';
import { getLayout } from '$lib/server/config';
import type { NavbarDiskItem, NavbarCpuItem } from '$lib/types';

export const GET: RequestHandler = async ({ request }) => {
	const layout = await getLayout();
	const allNavbarItems = Object.values(layout.layouts || {}).flatMap((l) => l.navbar?.items || []);
	const diskPaths = allNavbarItems
		.filter((item): item is NavbarDiskItem => item.type === 'navbar-disk')
		.flatMap((item) => item.config?.disks || []);

	const cpuSensor = allNavbarItems
		.find((item): item is NavbarCpuItem => item.type === 'navbar-cpu')
		?.config?.tempSensor;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const sendEvent = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			const poll = async () => {
				try {
					const [cpu, ram, disks] = await Promise.all([
						getCpuStats(cpuSensor),
						getRamStats(),
						getDiskStats(diskPaths.length > 0 ? diskPaths : undefined)
					]);
					sendEvent('system-stats', { cpu, ram, disks });
				} catch {
					// skip failed poll
				}
			};

			await poll();
			const interval = setInterval(poll, 3000);

			request.signal.addEventListener('abort', () => {
				clearInterval(interval);
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