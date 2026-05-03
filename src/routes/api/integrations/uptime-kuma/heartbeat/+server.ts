import type { RequestHandler } from './$types';
import { getIntegrations, getLayout } from '$lib/server/config';
import type { UptimeKumaStatusPageItem, NavbarUptimeKumaStatusPageItem, UptimeKumaMonitor, UptimeKumaStatusPageData } from '$lib/types';

export const GET: RequestHandler = async ({ request }) => {
	const integrations = await getIntegrations();
	const url = integrations.uptimeKuma?.url?.replace(/\/+$/, '');

	const layout = await getLayout();
	const slugs = new Set<string>();

	for (const item of layout.items || []) {
		if (item.type === 'uptime-kuma-status-page' && (item as UptimeKumaStatusPageItem).config?.slug) {
			slugs.add((item as UptimeKumaStatusPageItem).config.slug);
		}
	}
	for (const item of layout.navbar?.items || []) {
		if (item.type === 'navbar-uptime-kuma-status-page' && (item as NavbarUptimeKumaStatusPageItem).config?.slug) {
			slugs.add((item as NavbarUptimeKumaStatusPageItem).config.slug);
		}
	}

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const sendEvent = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			if (!url || slugs.size === 0) {
				sendEvent('uptime-kuma-status', { slugs: [] });
				try { controller.close(); } catch {}
				return;
			}

			const poll = async () => {
				for (const slug of slugs) {
					try {
						const [pageRes, heartbeatRes] = await Promise.all([
							fetch(`${url}/api/status-page/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(5000) }),
							fetch(`${url}/api/status-page/heartbeat/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(5000) })
						]);

						if (!pageRes.ok || !heartbeatRes.ok) continue;

						const pageData = await pageRes.json();
						const heartbeatData = await heartbeatRes.json();

						const title = pageData.config?.title || slug;
						const publicGroups: { monitorList: { id: number; name: string }[] }[] = pageData.publicGroupList || [];
						const heartbeatList: { [key: string]: { status: number }[] } = heartbeatData.heartbeatList || {};
						const uptimeList: { [key: string]: { '24h'?: number } } = heartbeatData.uptimeList || {};

						const monitors: UptimeKumaMonitor[] = [];
						let activeCount = 0;
						let inactiveCount = 0;
						let totalUptime = 0;
						let uptimeCount = 0;

						for (const group of publicGroups) {
							for (const mon of group.monitorList || []) {
								const heartbeats = heartbeatList[String(mon.id)] || [];
								const latestStatus = heartbeats.length > 0 ? heartbeats[heartbeats.length - 1].status : 0;
								const uptime24h = uptimeList[String(mon.id)]?.['24h'];
								const uptimePercent = uptime24h != null ? uptime24h * 100 : (latestStatus === 1 ? 100 : 0);

								monitors.push({
									id: mon.id,
									name: mon.name,
									status: latestStatus,
									uptime24h: Math.round(uptimePercent * 10) / 10
								});

								if (latestStatus === 1) activeCount++;
								else inactiveCount++;

								totalUptime += uptimePercent;
								uptimeCount++;
							}
						}

						const overallUptime = uptimeCount > 0 ? Math.round((totalUptime / uptimeCount) * 10) / 10 : 0;

						const result: UptimeKumaStatusPageData = {
							slug,
							title,
							monitors,
							activeCount,
							inactiveCount,
							overallUptime
						};

						sendEvent('uptime-kuma-status', result);
					} catch {
						// skip failed slug
					}
				}
			};

			await poll();
			const interval = setInterval(poll, 30000);

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