<script lang="ts">
	import type { AdGuardHomeConfig } from '$lib/types';
	import { adguardHomeData, isEditing, settings } from '$lib/stores/dashboard';

	let { config, colSpan = 1, rowSpan = 1, ondelete, itemid }: {
		config?: AdGuardHomeConfig;
		colSpan?: number;
		rowSpan?: number;
		ondelete?: () => void;
		itemid: string;
	} = $props();

	const instanceId = $derived(config?.instanceId || 'default');
	const data = $derived($adguardHomeData[instanceId]);
	const cells = $derived(colSpan * rowSpan);
	const showAll = $derived(cells >= 6 && rowSpan >= 3);
	const isWideBar = $derived(rowSpan <= 2 && colSpan >= 3);
	const isMicro = $derived(rowSpan === 1);
	const animations = $derived($settings?.animations || 'subtle');

	let pauseDuration = $state(300);
	let actionLoading = $state(false);

	const isActive = $derived(data?.protectionEnabled ?? false);
	const isPaused = $derived(data?.pausedUntil != null && Date.now() < data.pausedUntil);

	const quickDurations = [
		{ label: '30s', value: 30 },
		{ label: '1m', value: 60 },
		{ label: '5m', value: 300 },
		{ label: '10m', value: 600 },
		{ label: '30m', value: 1800 },
		{ label: '1h', value: 3600 }
	];

	async function toggleProtection(enabled: boolean, duration?: number) {
		actionLoading = true;
		try {
			const res = await fetch('/api/integrations/adguard-home/protection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled, duration, instanceId })
			});
			if (res.ok) {
				adguardHomeData.update((prev) => {
					const existing = prev[instanceId];
					if (!existing) return prev;
					return {
						...prev,
						[instanceId]: {
							...existing,
							protectionEnabled: enabled,
							pausedUntil: duration && !enabled ? Date.now() + duration * 1000 : undefined
						}
					};
				});
			}
		} catch {
			// silent fail
		} finally {
			actionLoading = false;
		}
	}
</script>

<div class="adguard-control-tile">
	<div
		class="control-content"
		class:bar={isWideBar}
		class:micro={isMicro}
		class:compact={!showAll && !isWideBar && !isMicro}
	>
		<button
			class="status-pill"
			class:active={isActive}
			class:paused={isPaused}
			class:anim-subtle={animations === 'subtle'}
			class:anim-full={animations === 'full'}
			onclick={() => toggleProtection(!isActive)}
			disabled={actionLoading}
			title={isPaused ? 'AdGuard Paused - click to resume' : isActive ? 'AdGuard Active - click to disable' : 'AdGuard Inactive - click to enable'}
		>
			<svg class="shield" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
			</svg>
			<span class="status-dot" class:active={isActive} class:paused={isPaused} class:anim-full={animations === 'full'}></span>
			<span class="label">{isPaused ? 'Paused' : isActive ? 'Active' : 'Off'}</span>
		</button>

		{#if isActive && !isPaused && showAll}
			<div class="pause-section">
				<span class="pause-label">Pause for</span>
				<div class="pause-buttons">
					{#each quickDurations as d}
						<button class="btn-pause" onclick={() => toggleProtection(false, d.value)} disabled={actionLoading}>
							{d.label}
						</button>
					{/each}
				</div>
				<div class="pause-custom">
					<input type="number" bind:value={pauseDuration} min="1" placeholder="seconds" />
					<button class="btn-pause-custom" onclick={() => toggleProtection(false, pauseDuration)} disabled={actionLoading}>
						Custom
					</button>
				</div>
			</div>
		{/if}
	</div>

	{#if $isEditing}
		<button class="btn-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(); }} onpointerdown={(e) => e.stopPropagation()} title="Remove AdGuard control">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.adguard-control-tile {
		position: relative;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: visible;
		padding: 4px;
	}

	.control-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.control-content.compact {
		gap: 4px;
	}

	.control-content.compact .status-pill {
		padding: 3px 10px;
		font-size: 0.72rem;
	}

	.control-content.compact .shield {
		width: 13px;
		height: 13px;
	}

	.control-content.bar {
		flex-direction: row;
		gap: 10px;
		justify-content: flex-start;
		padding-left: 6px;
	}

	.control-content.micro {
		flex-direction: row;
		gap: 6px;
		justify-content: center;
	}

	.control-content.micro .label {
		display: none;
	}

	.control-content.micro .status-pill {
		padding: 2px 8px;
		font-size: 0.65rem;
	}

	.control-content.micro .shield {
		width: 12px;
		height: 12px;
	}

	.status-pill {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 5px 14px;
		border-radius: var(--radius-sm);
		background: rgba(231, 76, 60, 0.15);
		border: 1px solid rgba(231, 76, 60, 0.3);
		color: #e74c3c;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.status-pill.active {
		background: rgba(46, 204, 113, 0.15);
		border-color: rgba(46, 204, 113, 0.3);
		color: #2ecc71;
	}

	.status-pill.paused {
		background: rgba(241, 196, 15, 0.15);
		border-color: rgba(241, 196, 15, 0.3);
		color: #f1c40f;
	}

	.status-pill.anim-subtle,
	.status-pill.anim-full {
		transition: background var(--transition), border-color var(--transition), color var(--transition);
	}

	.status-pill:hover:not(:disabled) {
		filter: brightness(1.15);
	}

	.status-pill:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.shield {
		flex-shrink: 0;
		stroke-width: 2.2;
	}

	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: currentColor;
		flex-shrink: 0;
		opacity: 0.8;
	}

	.status-dot.active {
		background: #2ecc71;
	}

	.status-dot.paused {
		background: #f1c40f;
	}

	.status-dot.anim-full.paused {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.label {
		font-weight: 600;
	}

	.pause-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		width: 100%;
	}

	.pause-label {
		font-size: 0.6rem;
		color: var(--text-muted);
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.pause-buttons {
		display: flex;
		gap: 3px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.btn-pause {
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-secondary);
		font-size: 0.65rem;
		font-weight: 500;
		cursor: pointer;
	}

	.btn-pause:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.btn-pause:disabled {
		opacity: 0.5;
	}

	.pause-custom {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.pause-custom input {
		width: 48px;
		padding: 2px 4px;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 0.7rem;
		color: var(--text-primary);
		outline: none;
	}

	.pause-custom input:focus {
		border-color: var(--accent);
	}

	.btn-pause-custom {
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-secondary);
		font-size: 0.65rem;
		font-weight: 500;
	}

	.btn-pause-custom:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.btn-pause-custom:disabled {
		opacity: 0.5;
	}

	.btn-delete {
		position: absolute;
		top: -8px;
		left: -8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--danger);
		color: white;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		pointer-events: auto;
		z-index: 10;
		opacity: 0;
		transition: opacity var(--transition);
	}

	.adguard-control-tile:hover .btn-delete {
		opacity: 1;
	}

	.btn-delete:hover {
		background: #c0392b;
	}
</style>
