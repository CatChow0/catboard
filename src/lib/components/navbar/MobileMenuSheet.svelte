<script lang="ts">
	// Phone menu (☰): edit mode, add, breakpoint being edited, settings, logout.
	import { isEditing, layout, activeBreakpointId, manualBreakpointId, getBreakpointLabel, toggleEditMode } from '$lib/stores/dashboard';
	import BottomSheet from '../BottomSheet.svelte';

	let { onclose, onadd, onsettings, onlogout }: {
		onclose: () => void;
		onadd?: () => void;
		onsettings: () => void;
		onlogout: () => void;
	} = $props();

	let versionInfo = $state<{ current: string; latest: string; hasUpdate: boolean } | null>(null);

	$effect(() => {
		fetch('/api/version')
			.then((res) => res.json())
			.then((data) => { versionInfo = data; })
			.catch(() => {});
	});

	function run(fn?: () => void) {
		onclose();
		fn?.();
	}
</script>

<BottomSheet label="Menu" {onclose}>
	<div class="mm">
		<button class="mm-item" class:active={$isEditing} onclick={() => run(toggleEditMode)}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				{#if $isEditing}
					<path d="M20 6L9 17l-5-5" />
				{:else}
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
				{/if}
			</svg>
			{$isEditing ? 'Done editing' : 'Edit dashboard'}
		</button>

		{#if $isEditing}
			<button class="mm-item" onclick={() => run(onadd)}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14" />
				</svg>
				Add service or widget
			</button>
			<label class="mm-item mm-select">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="2" y="4" width="20" height="14" rx="2" />
					<path d="M8 21h8" />
				</svg>
				<span>Layout</span>
				<select onchange={(e) => manualBreakpointId.set(e.currentTarget.value)} value={$manualBreakpointId || $activeBreakpointId}>
					{#each $layout?.grid?.breakpoints || [] as bp (bp.id)}
						<option value={bp.id}>{getBreakpointLabel($layout.grid.breakpoints, bp.id)}</option>
					{/each}
				</select>
			</label>
		{/if}

		<div class="mm-divider"></div>

		<button class="mm-item" onclick={() => run(onsettings)}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
			</svg>
			Settings
		</button>
		<button class="mm-item danger" onclick={() => run(onlogout)}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
				<polyline points="16 17 21 12 16 7" />
				<line x1="21" y1="12" x2="9" y2="12" />
			</svg>
			Logout
		</button>

		<p class="mm-version">
			v{versionInfo?.current || '…'}
			{#if versionInfo?.hasUpdate}<span>· update available: {versionInfo.latest}</span>{/if}
		</p>
	</div>
</BottomSheet>

<style>
	.mm {
		display: flex;
		flex-direction: column;
		padding: 0 8px;
	}

	.mm-item {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 52px;
		padding: 0 12px;
		border-radius: var(--radius-sm);
		font-size: 1rem;
		font-weight: 500;
		color: var(--text-primary);
		text-align: left;
	}

	.mm-item:active {
		background: var(--bg-card-hover);
	}

	.mm-item svg {
		flex-shrink: 0;
		color: var(--text-secondary);
	}

	.mm-item.active,
	.mm-item.active svg {
		color: var(--accent);
	}

	.mm-item.danger,
	.mm-item.danger svg {
		color: var(--danger);
	}

	.mm-select span {
		flex: 1;
	}

	.mm-select select {
		padding: 8px 10px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.95rem;
	}

	.mm-divider {
		height: 1px;
		margin: 6px 12px;
		background: var(--border);
	}

	.mm-version {
		margin: 8px 12px 4px;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.mm-version span {
		color: var(--danger);
	}
</style>
