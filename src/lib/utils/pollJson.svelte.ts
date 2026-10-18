// Polls a JSON endpoint while the page is visible, and again as soon as it
// becomes visible. Call it during component init: the effect stops with the
// component and restarts when url() changes (null pauses polling).

export function pollJson<T>(url: () => string | null, every: number | ((data: T | null) => number)) {
	const s = $state<{ data: T | null; error: string; reload: number }>({ data: null, error: '', reload: 0 });

	$effect(() => {
		const u = url();
		void s.reload;
		if (!u) return;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		async function load() {
			clearTimeout(timer);
			if (!document.hidden) {
				try {
					const res = await fetch(u!);
					const body = await res.json().catch(() => null);
					if (stopped) return;
					if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
					s.data = body;
					s.error = '';
				} catch (e) {
					if (!stopped) s.error = e instanceof Error ? e.message : String(e);
				}
			}
			if (!stopped) timer = setTimeout(load, typeof every === 'function' ? every(s.data as T | null) : every);
		}
		const onVisible = () => !document.hidden && load();
		document.addEventListener('visibilitychange', onVisible);
		load();
		return () => {
			stopped = true;
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	return {
		get data() { return s.data as T | null; },
		get error() { return s.error; },
		/** Poll again now (after an action). */
		refresh() { s.reload++; }
	};
}
