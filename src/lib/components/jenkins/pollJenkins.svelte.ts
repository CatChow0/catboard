// Polls the latest Jenkins builds (one job, or every job) while the tab is
// visible: every 15 s, every 5 s while something runs or waits in the queue.
// Call it during component init: the effect stops with the component.
import type { JenkinsData } from '$lib/types';
import { pollJson } from '$lib/utils/pollJson.svelte';

export function pollJenkins(params: () => { job: string; limit: number }) {
	return pollJson<JenkinsData>(
		() => {
			const { job, limit } = params();
			return `/api/integrations/jenkins/builds?job=${encodeURIComponent(job)}&limit=${limit}`;
		},
		(data) => (data && (data.inQueue || data.builds.some((b) => b.building)) ? 5000 : 15000)
	);
}
