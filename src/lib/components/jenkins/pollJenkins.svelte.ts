// Polls the latest Jenkins builds (one job, or every job) while the tab is
// visible: every 15 s, every 5 s while something runs or waits in the queue.
// Call it during component init: the effect stops with the component.
import type { JenkinsData } from '$lib/types';

export function pollJenkins(params: () => { job: string; limit: number }) {
	const s = $state<{ data: JenkinsData | null; error: string; reload: number }>({ data: null, error: '', reload: 0 });

	$effect(() => {
		const { job, limit } = params();
		void s.reload;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		async function load() {
			clearTimeout(timer);
			if (!document.hidden) {
				try {
					const res = await fetch(`/api/integrations/jenkins/builds?job=${encodeURIComponent(job)}&limit=${limit}`);
					const body = await res.json();
					if (stopped) return;
					if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
					s.data = body;
					s.error = '';
				} catch (e) {
					if (!stopped) s.error = e instanceof Error ? e.message : String(e);
				}
			}
			const busy = !!s.data && (s.data.inQueue || s.data.builds.some((b) => b.building));
			if (!stopped) timer = setTimeout(load, busy ? 5000 : 15000);
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
		get data() { return s.data; },
		get error() { return s.error; },
		/** Poll again now (after starting a build). */
		refresh() { s.reload++; }
	};
}
