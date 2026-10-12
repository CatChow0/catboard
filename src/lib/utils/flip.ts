// Svelte action that animates a grid item from its previous position to its new
// one (FLIP) whenever `key` changes — used so tiles pushed during a drag slide
// instead of jumping. Positions are tracked in document coordinates so page
// scrolling (auto-scroll while dragging) is not mistaken for movement.

interface FlipParams {
	key: string;
	animate: boolean;
}

function docRect(node: HTMLElement) {
	const r = node.getBoundingClientRect();
	return { left: r.left + window.scrollX, top: r.top + window.scrollY };
}

export function flipOnMove(node: HTMLElement, params: FlipParams) {
	let last = docRect(node);
	let key = params.key;

	return {
		update(next: FlipParams) {
			if (next.key === key) {
				// Same cell: just refresh the reference (window resize, scrolling…).
				last = docRect(node);
				return;
			}
			key = next.key;
			const now = docRect(node);
			const dx = last.left - now.left;
			const dy = last.top - now.top;
			last = now;
			if (!next.animate || (!dx && !dy)) return;
			if (node.closest('[data-animations="none"]') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
				duration: 150,
				easing: 'ease-out'
			});
		}
	};
}
