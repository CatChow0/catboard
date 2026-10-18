// Tile search shared by the dashboard (live highlight) and the navbar search
// results (every dashboard).
import type { DashboardItem, Service } from '$lib/types';

/** Human name of a widget type, used for matching and for result labels. */
export const WIDGET_NAMES: Record<string, string[]> = {
	calendar: ['Calendar'],
	clock: ['Clock'],
	weather: ['Weather'],
	docker: ['Docker'],
	'uptime-kuma-status-page': ['Uptime Kuma', 'uptime'],
	'adguard-home': ['AdGuard Home', 'adguard'],
	'adguard-home-control': ['AdGuard Home control', 'adguard'],
	'jellyfin-latest': ['Jellyfin latest', 'jellyfin'],
	'jellyfin-now-playing': ['Jellyfin now playing', 'jellyfin', 'playing'],
	'jellyseerr-requests': ['Jellyseerr requests', 'jellyseerr', 'overseerr', 'requests'],
	qbittorrent: ['qBittorrent', 'torrent'],
	notes: ['Notes'],
	spoolman: ['Spoolman', 'filament'],
	'elegoo-print': ['3D print status', 'printer', 'print', 'elegoo'],
	'arr-releases': ['Arr releases', 'releases', 'arr'],
	stacker: ['Stacker', 'system'],
	psitransfer: ['PsiTransfer', 'upload', 'share', 'files'],
	jenkins: ['Jenkins', 'builds', 'ci'],
	proxmox: ['Proxmox', 'vm', 'containers', 'virtualisation'],
	portainer: ['Portainer', 'stacks', 'containers'],
	immich: ['Immich', 'photos'],
	nextcloud: ['Nextcloud', 'files', 'cloud']
};

/** What a tile is called: service name, group / note title, or the widget name. */
export function itemLabel(item: DashboardItem, services: Service[]): string {
	if (item.type === 'service') return services.find((s) => s.id === item.serviceId)?.name ?? 'Service';
	if (item.type === 'group-collapsible' || item.type === 'group-standard') return item.title || 'Group';
	const title = (item as { config?: { title?: string } }).config?.title;
	const name = WIDGET_NAMES[item.type]?.[0] ?? item.type;
	return title ? `${title} (${name})` : name;
}

export function itemMatchesQuery(item: DashboardItem, q: string, services: Service[]): boolean {
	const lc = q.trim().toLowerCase();
	if (!lc) return false;
	if (item.type === 'service') {
		const svc = services.find((s) => s.id === item.serviceId);
		return !!svc && (svc.name.toLowerCase().includes(lc) || (svc.description ?? '').toLowerCase().includes(lc));
	}
	if (item.type === 'group-collapsible' || item.type === 'group-standard') return !!item.title?.toLowerCase().includes(lc);
	const title = ((item as { config?: { title?: string } }).config?.title ?? '').toLowerCase();
	if (title.includes(lc)) return true;
	return (WIDGET_NAMES[item.type] ?? []).some((w) => w.toLowerCase().includes(lc));
}

/** Ids of matching tiles, groups' children included. */
export function matchingItemIds(items: DashboardItem[], q: string, services: Service[]): Set<string> {
	const ids = new Set<string>();
	const visit = (it: DashboardItem) => {
		if (itemMatchesQuery(it, q, services)) ids.add(it.id);
		if ('children' in it) it.children.forEach(visit);
	};
	items.forEach(visit);
	return ids;
}

export interface SearchHit {
	dashboardId: string;
	dashboardName: string;
	itemId: string;
	label: string;
	/** Group the tile sits in, if any. */
	group?: string;
}

/** Matches on every dashboard, the current one first. */
export function searchDashboards(
	index: { id: string; name: string; items: DashboardItem[] }[],
	q: string,
	services: Service[],
	currentId: string
): { dashboardId: string; dashboardName: string; hits: SearchHit[] }[] {
	if (!q.trim()) return [];
	const groups = index.map((d) => {
		const hits: SearchHit[] = [];
		const visit = (it: DashboardItem, group?: string) => {
			if (itemMatchesQuery(it, q, services)) hits.push({ dashboardId: d.id, dashboardName: d.name, itemId: it.id, label: itemLabel(it, services), group });
			if ('children' in it) it.children.forEach((c) => visit(c, itemLabel(it, services)));
		};
		d.items.forEach((it) => visit(it));
		return { dashboardId: d.id, dashboardName: d.name, hits };
	});
	return groups.filter((g) => g.hits.length).sort((a, b) => (a.dashboardId === currentId ? -1 : b.dashboardId === currentId ? 1 : 0));
}
