<script lang="ts">
	import { onMount } from 'svelte';
	import Dashboard from '$lib/components/Dashboard.svelte';
	import { loadDashboard, serviceStatuses, systemStats, uptimeKumaData, dockerData, adguardHomeData } from '$lib/stores/dashboard';

	let loaded = $state(false);

	onMount(() => {
		loadDashboard(window.innerWidth).then(() => { loaded = true; });

		// Status checks: fetch once then every 5 minutes (not SSE)
		async function fetchStatuses() {
			try {
				const res = await fetch('/api/status');
				if (res.ok) {
					const data = await res.json();
					serviceStatuses.set(data);
				}
			} catch {
				// silent fail
			}
		}
		fetchStatuses();
		const statusInterval = setInterval(fetchStatuses, 300_000);

		const statsSource = new EventSource('/api/system-stats');
		statsSource.addEventListener('system-stats', (e) => {
			const data = JSON.parse(e.data);
			systemStats.set(data);
		});

		const uptimeKumaSource = new EventSource('/api/integrations/uptime-kuma/heartbeat');
		uptimeKumaSource.addEventListener('uptime-kuma-status', (e) => {
			const data = JSON.parse(e.data);
			uptimeKumaData.update((prev) => ({
				...prev,
				[data.slug]: data
			}));
		});

		const dockerSource = new EventSource('/api/integrations/docker/heartbeat');
		dockerSource.addEventListener('docker-status', (e) => {
			const data = JSON.parse(e.data);
			dockerData.update((prev) => ({
				...prev,
				[data.environmentId]: data
			}));
		});

		const adguardSource = new EventSource('/api/integrations/adguard-home/heartbeat');
		adguardSource.addEventListener('adguard-home-status', (e) => {
			const data = JSON.parse(e.data);
			adguardHomeData.update((prev) => ({
				...prev,
				[data.instanceId]: data
			}));
		});

		return () => {
			clearInterval(statusInterval);
			statsSource.close();
			uptimeKumaSource.close();
			dockerSource.close();
			adguardSource.close();
		};
	});
</script>

{#if loaded}
	<Dashboard />
{:else}
	<div class="loading">
		<div class="spinner"></div>
		<p>Loading dashboard...</p>
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
