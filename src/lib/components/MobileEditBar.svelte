<script lang="ts">
	// Phone edit mode: layout being edited, Add and Done, within thumb reach.
	import { t } from '$lib/i18n';
	import { layout, activeBreakpointId, manualBreakpointId, getBreakpointLabel, toggleEditMode } from '$lib/stores/dashboard';

	let { onadd }: { onadd: () => void } = $props();
</script>

<div class="meb" role="toolbar" aria-label={$t('nav.editDashboard')}>
	<label class="meb-layout">
		<span class="meb-hint">{$t('nav.layout')}</span>
		<select onchange={(e) => manualBreakpointId.set(e.currentTarget.value)} value={$manualBreakpointId || $activeBreakpointId}>
			{#each $layout?.grid?.breakpoints || [] as bp (bp.id)}
				<option value={bp.id}>{getBreakpointLabel($layout.grid.breakpoints, bp.id)}</option>
			{/each}
		</select>
	</label>
	<button class="meb-btn add" onclick={onadd}>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
			<path d="M12 5v14M5 12h14" />
		</svg>
		{$t('nav.add')}
	</button>
	<button class="meb-btn done" onclick={toggleEditMode}>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
			<path d="M20 6L9 17l-5-5" />
		</svg>
		{$t('nav.done')}
	</button>
</div>

<style>
	.meb {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 900;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
		background: var(--bg-modal);
		border-top: 1px solid var(--border-light);
		box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.3);
	}

	.meb-layout {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.meb-hint {
		font-size: 0.68rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.meb-layout select {
		width: 100%;
		padding: 6px 8px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.95rem;
	}

	.meb-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		height: 44px;
		padding: 0 16px;
		border-radius: var(--radius-sm);
		font-size: 0.95rem;
		font-weight: 600;
	}

	.meb-btn.add {
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		color: var(--text-primary);
	}

	.meb-btn.done {
		background: var(--accent);
		color: white;
	}
</style>
