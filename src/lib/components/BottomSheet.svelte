<script lang="ts">
	// Phone bottom sheet: slides up from the bottom edge, closes on backdrop tap,
	// Escape, or a downward swipe on the handle. Used for menus and popovers on phones.
	import { t } from '$lib/i18n';
	import type { Snippet } from 'svelte';

	let { label, title, onclose, children }: {
		label: string;
		title?: string;
		onclose: () => void;
		children: Snippet;
	} = $props();

	let sheet = $state<HTMLDivElement>();
	let dragY = $state(0);
	let dragStart: { id: number; y: number } | null = null;
	// A sheet opened on pointer release (touch hold menu) would otherwise be closed
	// by that same tap's click landing on the new backdrop.
	const openedAt = performance.now();

	function backdropClick() {
		if (performance.now() - openedAt > 350) onclose();
	}

	$effect(() => {
		sheet?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onclose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function handleDown(e: PointerEvent) {
		dragStart = { id: e.pointerId, y: e.clientY };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handleMove(e: PointerEvent) {
		if (dragStart?.id !== e.pointerId) return;
		dragY = Math.max(0, e.clientY - dragStart.y);
	}

	function handleUp(e: PointerEvent) {
		if (dragStart?.id !== e.pointerId) return;
		dragStart = null;
		if (dragY > 80) onclose();
		dragY = 0;
	}
</script>

<!-- Presses must not reach the dashboard below (tile drags, swipes). -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="bs-overlay" onpointerdown={(e) => e.stopPropagation()}>
	<button type="button" class="bs-backdrop" aria-label={$t('common.close')} tabindex="-1" onclick={backdropClick}></button>
	<div
		bind:this={sheet}
		class="bs-sheet"
		class:dragging={dragY > 0}
		role="dialog"
		aria-modal="true"
		aria-label={label}
		tabindex="-1"
		style="transform: translateY({dragY}px);"
	>
		<div
			class="bs-handle"
			onpointerdown={handleDown}
			onpointermove={handleMove}
			onpointerup={handleUp}
			onpointercancel={handleUp}
		>
			<span></span>
		</div>
		{#if title}<h2 class="bs-title">{title}</h2>{/if}
		<div class="bs-body">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.bs-overlay {
		position: fixed;
		inset: 0;
		z-index: 1050;
		display: flex;
		align-items: flex-end;
		background: rgba(0, 0, 0, 0.55);
		animation: bs-fade 0.15s ease;
	}

	.bs-backdrop {
		position: absolute;
		inset: 0;
		/* Buttons don't stretch between left/right: size it explicitly. */
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: default;
	}

	.bs-sheet {
		position: relative;
		width: 100%;
		max-height: calc(100vh - 48px);
		max-height: calc(100dvh - 48px);
		display: flex;
		flex-direction: column;
		background: var(--bg-modal);
		border-top: 1px solid var(--border-light);
		border-radius: 16px 16px 0 0;
		box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.35);
		padding-bottom: env(safe-area-inset-bottom);
		outline: none;
		text-align: left;
		animation: bs-up 0.22s cubic-bezier(0.16, 1, 0.3, 1);
		transition: transform 0.18s ease;
	}

	.bs-sheet.dragging {
		transition: none;
	}

	.bs-handle {
		display: flex;
		justify-content: center;
		padding: 10px 0 6px;
		touch-action: none;
		cursor: grab;
	}

	.bs-handle span {
		width: 40px;
		height: 4px;
		border-radius: 2px;
		background: var(--border-light);
	}

	.bs-title {
		margin: 0;
		padding: 0 18px 8px;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.bs-body {
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0 0 8px;
	}

	@keyframes bs-up {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	@keyframes bs-fade {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	:global([data-animations='none']) .bs-overlay,
	:global([data-animations='none']) .bs-sheet {
		animation: none;
	}
</style>
