<script lang="ts">
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import Dashboard from '$lib/components/Dashboard.svelte';
	import { loadDashboard, serviceStatuses, systemStats, uptimeKumaData, dockerData, adguardHomeData, settings } from '$lib/stores/dashboard';

	let loaded = $state(false);

	onMount(() => {
		loadDashboard(window.innerWidth).then(() => { loaded = true; });

		// Service status checks, at the user's check interval (the server shares
		// and caches the results).
		let statusTimer: ReturnType<typeof setTimeout> | undefined;
		async function fetchStatuses() {
			clearTimeout(statusTimer);
			try {
				const res = await fetch('/api/status');
				if (res.ok) serviceStatuses.set(await res.json());
			} catch {
				// silent fail
			}
			const every = Math.min(600_000, Math.max(10_000, get(settings).statusCheckInterval || 30_000));
			statusTimer = setTimeout(fetchStatuses, every);
		}

		// Live streams, open only while the page is visible: a hidden tab costs
		// the server nothing.
		let sources: EventSource[] = [];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		function listen(url: string, event: string, onData: (data: any) => void) {
			const source = new EventSource(url);
			source.addEventListener(event, (e) => onData(JSON.parse((e as MessageEvent).data)));
			sources.push(source);
		}
		function start() {
			fetchStatuses();
			listen('/api/system-stats', 'system-stats', (data) => systemStats.set(data));
			listen('/api/integrations/uptime-kuma/heartbeat', 'uptime-kuma-status', (data) => uptimeKumaData.update((prev) => ({ ...prev, [data.slug]: data })));
			listen('/api/integrations/docker/heartbeat', 'docker-status', (data) => dockerData.update((prev) => ({ ...prev, [data.environmentId]: data })));
			listen('/api/integrations/adguard-home/heartbeat', 'adguard-home-status', (data) => adguardHomeData.update((prev) => ({ ...prev, [data.instanceId]: data })));
		}
		function stop() {
			clearTimeout(statusTimer);
			for (const source of sources) source.close();
			sources = [];
		}
		const onVisibility = () => {
			stop();
			if (!document.hidden) start();
		};

		if (!document.hidden) start();
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			stop();
		};
	});
</script>

{#if loaded}
	<Dashboard />
{:else}
	<div class="loading">
		<div class="spinner"></div>
		<p>{$t('dashboard.loading')}</p>
	</div>
{/if}

<style>
	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		gap: 16px;
		color: var(--text-muted);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
