<script lang="ts">
	// Settings modal shared by widgets: header, body (snippet), Cancel / Save.
	// Body content can use the .field, .hint and .toggle-switch classes.
	import type { Snippet } from 'svelte';

	let { title, onclose, onsave, saveDisabled = false, children }: {
		title: string;
		onclose: () => void;
		onsave: () => void;
		saveDisabled?: boolean;
		children: Snippet;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="wm-overlay" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" onclick={onclose} onpointerdown={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="wm" onclick={(e) => e.stopPropagation()}>
		<div class="wm-header">
			<h2>{title}</h2>
			<button class="wm-close" onclick={onclose} aria-label="Close">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
			</button>
		</div>
		<div class="wm-body">{@render children()}</div>
		<div class="wm-actions">
			<button class="wm-cancel" onclick={onclose}>Cancel</button>
			<button class="wm-save" onclick={onsave} disabled={saveDisabled}>Save</button>
		</div>
	</div>
</div>

<style>
	.wm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: wm-fade 0.15s ease;
	}

	.wm {
		background: var(--bg-modal);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		max-width: 440px;
		width: 90%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		animation: wm-up 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.wm-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.wm-header h2 {
		font-size: 1rem;
	}

	.wm-close {
		padding: 4px;
		border-radius: 4px;
		display: flex;
	}

	.wm-close:hover {
		background: var(--bg-card-hover);
	}

	.wm-body {
		padding: 16px 20px;
		overflow-y: auto;
	}

	.wm-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
	}

	.wm-cancel {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		color: var(--text-secondary);
	}

	.wm-save {
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: white;
		font-weight: 500;
	}

	.wm-save:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.wm-save:disabled {
		opacity: 0.5;
	}

	/* Shared form styles for modal bodies. */
	.wm-body :global(.field) {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.wm-body :global(.field input),
	.wm-body :global(.field select),
	.wm-body :global(.field textarea) {
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-primary);
		color: var(--text-primary);
		font: inherit;
	}

	.wm-body :global(.hint) {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	@keyframes wm-fade {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes wm-up {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
