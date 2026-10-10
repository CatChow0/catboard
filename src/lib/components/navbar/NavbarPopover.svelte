<script lang="ts">
	// Details popover anchored under a navbar widget. Fixed-positioned so the
	// navbar grid never clips it; closes on outside click or Escape and follows the
	// anchor when the page scrolls or resizes.
	import type { Snippet } from 'svelte';

	let { anchor, onclose, label, width = 300, children }: {
		anchor: HTMLElement;
		onclose: () => void;
		label: string;
		width?: number;
		children: Snippet;
	} = $props();

	let popover = $state<HTMLDivElement>();
	let pos = $state({ left: 0, top: 0, maxHeight: 400 });

	function place() {
		const r = anchor.getBoundingClientRect();
		const w = Math.min(width, window.innerWidth - 16);
		let left = r.left;
		if (left + w > window.innerWidth - 8) left = Math.max(8, r.right - w);
		const top = r.bottom + 6;
		pos = { left, top, maxHeight: Math.max(160, Math.min(window.innerHeight * 0.6, window.innerHeight - top - 12)) };
	}

	$effect(() => {
		place();
		popover?.focus();

		const onPointer = (e: PointerEvent) => {
			const t = e.target as Node;
			// Clicks on the anchor are handled by the widget itself (it toggles).
			if (!popover?.contains(t) && !anchor.contains(t)) onclose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onclose();
				anchor.focus();
			}
		};
		// Scrolling inside the popover is just reading the list; scrolling the page
		// moves the anchor, so follow it rather than closing.
		const onScroll = (e: Event) => {
			if (popover?.contains(e.target as Node)) return;
			place();
		};
		const onResize = () => place();
		// Registered after the opening click has finished propagating.
		const timer = setTimeout(() => {
			document.addEventListener('pointerdown', onPointer);
			window.addEventListener('keydown', onKey);
			window.addEventListener('resize', onResize);
			window.addEventListener('scroll', onScroll, true);
		}, 0);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('pointerdown', onPointer);
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('scroll', onScroll, true);
		};
	});
</script>

<div
	bind:this={popover}
	class="navbar-popover"
	role="dialog"
	aria-label={label}
	tabindex="-1"
	style="left: {pos.left}px; top: {pos.top}px; width: {Math.min(width, 9999)}px; max-height: {pos.maxHeight}px;"
>
	{@render children()}
</div>

<style>
	.navbar-popover {
		position: fixed;
		z-index: 200;
		max-width: calc(100vw - 16px);
		overflow-y: auto;
		background: var(--bg-modal);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow);
		outline: none;
		animation: pop-in 0.12s ease-out;
		text-align: left;
		white-space: normal;
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	:global([data-animations='none']) .navbar-popover {
		animation: none;
	}
</style>
