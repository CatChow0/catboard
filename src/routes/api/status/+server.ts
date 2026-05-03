import type { RequestHandler } from './$types';
import { getServices } from '$lib/server/config';

export const GET: RequestHandler = async ({ request }) => {
	const data = await getServices();
	const services = data.services.filter((s) => s.statusCheck?.enabled);

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			// Initial status check for all services
			const checkService = async (url: string, method: string) => {
				try {
					const response = await fetch(url, { method, signal: AbortSignal.timeout(5000) });
					return response.ok ? 'online' : 'error';
				} catch {
					return 'offline';
				}
			};

			// Send initial statuses
			for (const service of services) {
				const status = await checkService(service.url, service.statusCheck.method || 'HEAD');
				sendEvent('status', { id: service.id, status });
			}

			// Keep connection alive and re-check periodically
			const interval = setInterval(async () => {
				for (const service of services) {
					const status = await checkService(service.url, service.statusCheck.method || 'HEAD');
					sendEvent('status', { id: service.id, status });
				}
			}, 30000);

			// Clean up on disconnect
			request.signal.addEventListener('abort', () => {
				clearInterval(interval);
				try { controller.close(); } catch { /* already closed */ }
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