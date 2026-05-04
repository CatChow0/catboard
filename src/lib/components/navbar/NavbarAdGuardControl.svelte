<script lang="ts">
	import type { AdGuardHomeConfig } from '$lib/types';
	import { adguardHomeData } from '$lib/stores/dashboard';

	let { config }: { config: AdGuardHomeConfig } = $props();

	const instanceId = $derived(config?.instanceId || 'default');
	const align = $derived(config?.align || 'center');
	const data = $derived($adguardHomeData[instanceId]);
	const isActive = $derived(data?.protectionEnabled ?? false);
	const isPaused = $derived(data?.pausedUntil != null && Date.now() < data.pausedUntil);
	let loading = $state(false);

	async function toggle() {
		if (loading) return;
		loading = true;
		try {
			const res = await fetch('/api/integrations/adguard-home/protection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: !isActive, instanceId })
			});
			if (res.ok) {
				adguardHomeData.update((prev) => {
					const existing = prev[instanceId];
					if (!existing) return prev;
					return {
						...prev,
						[instanceId]: { ...existing, protectionEnabled: !isActive, pausedUntil: undefined }
					};
				});
			}
		} catch {
			// silent fail
		} finally {
			loading = false;
		}
	}
</script>

<div class="navbar-adguard-wrapper" style:justify-content={align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'}>
	<button
		class="navbar-adguard-control"
		class:active={isActive}
		class:paused={isPaused}
		onclick={toggle}
		disabled={loading}
		title={isPaused ? 'AdGuard Paused' : isActive ? 'AdGuard Active - click to disable' : 'AdGuard Inactive - click to enable'}
	>
	<svg class="shield" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
	</svg>
		<span class="label">{isPaused ? 'Paused' : isActive ? 'Active' : 'Off'}</span>
	</button>
</div>

<style>
	.navbar-adguard-wrapper {
		display: flex;
		width: 100%;
	}

	.navbar-adguard-control {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 3px 10px;
		font-size: 0.72rem;
		white-space: nowrap;
		background: rgba(231, 76, 60, 0.15);
		border: 1px solid rgba(231, 76, 60, 0.3);
		color: #e74c3c;
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: all var(--transition);
	}

	.navbar-adguard-control.active {
		background: rgba(46, 204, 113, 0.15);
		border-color: rgba(46, 204, 113, 0.3);
		color: #2ecc71;
	}

	.navbar-adguard-control.paused {
		background: rgba(241, 196, 15, 0.15);
		border-color: rgba(241, 196, 15, 0.3);
		color: #f1c40f;
	}

	.navbar-adguard-control:hover {
		filter: brightness(1.15);
	}

	.navbar-adguard-control:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.shield {
		flex-shrink: 0;
		stroke-width: 2.2;
	}

	.label {
		font-weight: 600;
	}
</style>
