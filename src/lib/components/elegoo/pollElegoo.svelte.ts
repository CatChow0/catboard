// Polls the print status of a CC2 printer while the tab is visible. Call it
// during component init: the effect stops with the component.
import type { ElegooStatus } from '$lib/types';
import { errorText } from '$lib/i18n';

export function pollElegoo(printerId: () => string, intervalMs = 3000) {
	const s = $state<{ status: ElegooStatus | null; error: string; reload: number }>({ status: null, error: '', reload: 0 });

	$effect(() => {
		const id = printerId();
		void s.reload;
		if (!id) return;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		async function load() {
			clearTimeout(timer);
			if (!document.hidden) {
				try {
					const res = await fetch(`/api/integrations/elegoo/status?printer=${encodeURIComponent(id)}`);
					const body = await res.json();
					if (stopped) return;
					if (!res.ok) throw new Error(errorText(body, res.status));
					s.status = body;
					s.error = '';
				} catch (e) {
					if (!stopped) s.error = e instanceof Error ? e.message : String(e);
				}
			}
			if (!stopped) timer = setTimeout(load, intervalMs);
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
		get status() { return s.status; },
		get error() { return s.error; },
		/** Poll again now (after an action). */
		refresh() { s.reload++; }
	};
}
