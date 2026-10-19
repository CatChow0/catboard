// Widget components by item type, loaded on demand: a dashboard only downloads
// the code of the widgets it shows. Resolved modules are kept so a widget that
// re-renders (layout change, dashboard swipe) never waits again.
import type { Component } from 'svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loader = () => Promise<{ default: Component<any> }>;

export const GRID_WIDGETS: Partial<Record<string, Loader>> = {
	calendar: () => import('$lib/components/Calendar.svelte'),
	clock: () => import('$lib/components/Clock.svelte'),
	weather: () => import('$lib/components/Weather.svelte'),
	docker: () => import('$lib/components/Docker.svelte'),
	'uptime-kuma-status-page': () => import('$lib/components/UptimeKumaStatusPage.svelte'),
	'adguard-home': () => import('$lib/components/AdGuardStats.svelte'),
	'adguard-home-control': () => import('$lib/components/AdGuardControl.svelte'),
	'jellyfin-latest': () => import('$lib/components/JellyfinLatest.svelte'),
	'arr-releases': () => import('$lib/components/ArrReleases.svelte'),
	stacker: () => import('$lib/components/Stacker.svelte'),
	'jellyfin-now-playing': () => import('$lib/components/JellyfinNowPlaying.svelte'),
	'jellyseerr-requests': () => import('$lib/components/JellyseerrRequests.svelte'),
	qbittorrent: () => import('$lib/components/QBittorrent.svelte'),
	notes: () => import('$lib/components/Notes.svelte'),
	spoolman: () => import('$lib/components/Spoolman.svelte'),
	'elegoo-print': () => import('$lib/components/ElegooPrint.svelte'),
	jenkins: () => import('$lib/components/Jenkins.svelte'),
	psitransfer: () => import('$lib/components/PsiTransfer.svelte'),
	proxmox: () => import('$lib/components/Proxmox.svelte'),
	portainer: () => import('$lib/components/Portainer.svelte'),
	immich: () => import('$lib/components/Immich.svelte'),
	nextcloud: () => import('$lib/components/Nextcloud.svelte'),
	gitea: () => import('$lib/components/Gitea.svelte')
};

export const NAVBAR_WIDGETS: Partial<Record<string, Loader>> = {
	'navbar-cpu': () => import('$lib/components/navbar/NavbarCpuWidget.svelte'),
	'navbar-ram': () => import('$lib/components/navbar/NavbarRamWidget.svelte'),
	'navbar-disk': () => import('$lib/components/navbar/NavbarDiskWidget.svelte'),
	'navbar-uptime-kuma-status-page': () => import('$lib/components/navbar/NavbarUptimeKumaStatusPage.svelte'),
	'navbar-docker': () => import('$lib/components/navbar/NavbarDocker.svelte'),
	'navbar-adguard-home-control': () => import('$lib/components/navbar/NavbarAdGuardControl.svelte'),
	'navbar-clock': () => import('$lib/components/navbar/NavbarClock.svelte'),
	'navbar-weather': () => import('$lib/components/navbar/NavbarWeather.svelte'),
	'navbar-elegoo-print': () => import('$lib/components/navbar/NavbarElegooPrint.svelte'),
	'navbar-jenkins': () => import('$lib/components/navbar/NavbarJenkins.svelte'),
	'navbar-proxmox': () => import('$lib/components/navbar/NavbarProxmox.svelte')
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loaded = new Map<Loader, Component<any>>();

/** The component if it was loaded before, so it renders without a skeleton. */
export function loadedWidget(loader: Loader) {
	return loaded.get(loader);
}

export async function loadWidget(loader: Loader) {
	const mod = await loader();
	loaded.set(loader, mod.default);
	return mod.default;
}
