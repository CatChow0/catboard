// Integration connections as seen by this browser (secrets are blank for
// non-admins). Widget settings forms read their pickers from here (Docker
// environments, Stacker servers, printers...) and the widget catalog uses it
// to tell which widgets still need a connection.
import { writable } from 'svelte/store';
import type { IntegrationsConfig } from '$lib/types';
import { getIntegrations } from '$lib/stores/dashboard';

export const integrations = writable<IntegrationsConfig>({});
export const integrationsLoaded = writable(false);

let pending: Promise<IntegrationsConfig> | null = null;

/** Load the connections once (pass force after a change to read them again). */
export function loadIntegrations(force = false): Promise<IntegrationsConfig> {
	if (pending && !force) return pending;
	pending = getIntegrations()
		.then((cfg) => {
			integrations.set(cfg);
			integrationsLoaded.set(true);
			return cfg;
		})
		.catch(() => {
			pending = null;
			integrationsLoaded.set(true);
			return {};
		});
	return pending;
}
