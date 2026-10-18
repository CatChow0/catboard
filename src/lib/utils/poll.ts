// Interval refresh that pauses while the page is hidden: no request from a
// background tab, and one at once when the page comes back after a missed tick.

/** Calls fn every ms while the page is visible (the caller does the first load). Returns a stop function. */
export function whileVisible(fn: () => void, ms: number): () => void {
	let last = Date.now();
	const tick = () => {
		if (document.hidden) return;
		last = Date.now();
		fn();
	};
	const timer = setInterval(tick, ms);
	const onVisible = () => {
		if (!document.hidden && Date.now() - last >= ms) tick();
	};
	document.addEventListener('visibilitychange', onVisible);
	return () => {
		clearInterval(timer);
		document.removeEventListener('visibilitychange', onVisible);
	};
}
