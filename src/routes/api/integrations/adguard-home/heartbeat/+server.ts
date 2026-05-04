import type { RequestHandler } from './$types';
import { getIntegrations } from '$lib/server/config';
import { getLayout } from '$lib/server/config';
import { pausedInstances, basicAuth, setAdGuardProtection } from '$lib/server/adguard-home';
import type { AdGuardHomeData } from '$lib/types';

async function fetchAdGuardStatus(url: string, auth: string): Promise<{ protectionEnabled: boolean }> {
	const res = await fetch(`${url.replace(/\/+$/, '')}/control/status`, {
		headers: { Authorization: auth, Accept: 'application/json' },
		signal: AbortSignal.timeout(5000)
	});
	if (!res.ok) throw new Error(`Status ${res.status}`);
	const data = await res.json();
	return { protectionEnabled: !!data.protection_enabled };
}

async function fetchAdGuardStats(url: string, auth: string): Promise<AdGuardHomeData['stats']> {
	const res = await fetch(`${url.replace(/\/+$/, '')}/control/stats`, {
		headers: { Authorization: auth, Accept: 'application/json' },
		signal: AbortSignal.timeout(5000)
	});
	if (!res.ok) throw new Error(`Stats ${res.status}`);
	const data = await res.json();
	return {
		dnsQueries: data.num_dns_queries ?? 0,
		blockedQueries: data.num_blocked_filtering ?? 0,
		blockedDomains: (data.num_blocked_filtering ?? 0) + (data.num_replaced_parental ?? 0) + (data.num_replaced_safebrowsing ?? 0),
		avgProcessingTime: data.avg_processing_time ?? 0
	};
}

async function fetchAdGuardFilterRules(url: string, auth: string): Promise<number> {
	const res = await fetch(`${url.replace(/\/+$/, '')}/control/filtering/status`, {
		headers: { Authorization: auth, Accept: 'application/json' },
		signal: AbortSignal.timeout(5000)
	});
	if (!res.ok) return 0;
	const data = await res.json();
	let count = 0;
	for (const f of data.filters || []) {
		count += f.rules_count || 0;
	}
	count += (data.user_rules || []).length;
	return count;
}

export const GET: RequestHandler = async ({ request }) => {
	const integrations = await getIntegrations();
	if (!integrations.adguardHome?.url) {
		return new Response('Not configured', { status: 404 });
	}

	const layout = await getLayout();
	const usedIds = new Set<string>();
	for (const item of layout.items || []) {
		if ((item.type === 'adguard-home' || item.type === 'adguard-home-control') && item.config?.instanceId) {
			usedIds.add(item.config.instanceId);
		}
	}
	for (const item of layout.navbar?.items || []) {
		if ((item.type === 'navbar-adguard-home' || item.type === 'navbar-adguard-home-control') && item.config?.instanceId) {
			usedIds.add(item.config.instanceId);
		}
	}

	const conn = integrations.adguardHome;
	const auth = basicAuth(conn.username, conn.password);
	const baseUrl = conn.url;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const sendEvent = (event: string, data: unknown) => {
				try {
					controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				} catch { /* controller closed */ }
			};

			const poll = async () => {
				try {
					// Check and auto-resume paused instances
					for (const [instanceId, pausedUntil] of pausedInstances) {
						if (Date.now() >= pausedUntil) {
							try {
								await setAdGuardProtection(baseUrl, auth, true);
								pausedInstances.delete(instanceId);
							} catch {
								// ignore auto-resume failure
							}
						}
					}

					const status = await fetchAdGuardStatus(baseUrl, auth);
					const stats = await fetchAdGuardStats(baseUrl, auth);
					const filterRules = await fetchAdGuardFilterRules(baseUrl, auth);

					for (const instanceId of usedIds) {
						const payload: AdGuardHomeData = {
							instanceId,
							protectionEnabled: status.protectionEnabled,
							pausedUntil: pausedInstances.get(instanceId),
							stats: { ...stats, blockedDomains: filterRules }
						};
						sendEvent('adguard-home-status', payload);
					}
				} catch {
					// skip failed poll
				}
			};

			await poll();
			const interval = setInterval(poll, 30000);

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
